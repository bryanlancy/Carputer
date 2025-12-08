#include <ftxui/dom/elements.hpp>
#include <ftxui/screen/screen.hpp>
#include <ftxui/component/component.hpp>
#include <ftxui/component/screen_interactive.hpp>
#include <ftxui/component/event.hpp>
#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <map>
#include <cstdlib>
#include <algorithm>
#include <random>
#include <unistd.h>
#include <libgen.h>
#include <limits.h>
#include <cstring>
#include <cstdio>
#include <thread>
#include <chrono>
#include <atomic>
#include <csignal>
#include <termios.h>
#include <unistd.h>
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

using namespace ftxui;
using namespace std;

// Global variables
string SCRIPT_DIR;
string ROOT_ENV_FILE;
atomic<bool> should_exit(false);
struct termios saved_termios;
bool termios_saved = false;

// Save terminal attributes
void save_terminal() {
    if (!termios_saved) {
        tcgetattr(STDIN_FILENO, &saved_termios);
        termios_saved = true;
    }
}

// Restore terminal state before exit
void restore_terminal() {
    // Write newline first to get out of raw mode
    write(STDOUT_FILENO, "\n", 1);

    // Restore saved terminal attributes
    if (termios_saved) {
        tcsetattr(STDIN_FILENO, TCSANOW, &saved_termios);
    }

    // Reset terminal to normal mode (suppress errors)
    system("stty sane 2>/dev/null");
    system("stty echo 2>/dev/null");  // Re-enable echo
    system("stty icanon 2>/dev/null"); // Re-enable canonical mode
    system("stty cooked 2>/dev/null"); // Cooked mode

    // Reset cursor color to default
    cout << "\033]12;\007";  // Reset cursor color to default

    // Clear screen attributes and show cursor
    cout << "\033[?25h";     // Show cursor (DECSET - DECTCEM)
    cout << "\033[0m";       // Reset all attributes
    cout << "\033[?1000l";   // Disable mouse reporting
    cout << "\033[?1002l";   // Disable mouse drag reporting
    cout << "\033[?1003l";   // Disable mouse movement reporting
    cout << "\033[?1006l";   // Disable SGR mouse reporting
    cout << "\033[?25h";     // Ensure cursor is shown again
    cout.flush();

    // Ensure we're in canonical mode
    fflush(stdout);
    fflush(stderr);
}


// Signal handler for Ctrl-C
void signal_handler(int signal) {
    if (signal == SIGINT) {
        should_exit = true;
        restore_terminal();
        _exit(1); // Use _exit to avoid calling destructors that might interfere
    }
}

// Initialize script directory
void init_script_dir() {
    char cwd[4096];
    if (getcwd(cwd, sizeof(cwd)) != nullptr) {
        SCRIPT_DIR = string(cwd);
        // If we're in scripts/cc-server, go up two levels to fleet-cc-server
        if (SCRIPT_DIR.find("/scripts/cc-server") != string::npos) {
            size_t pos = SCRIPT_DIR.find("/scripts/cc-server");
            SCRIPT_DIR = SCRIPT_DIR.substr(0, pos);
        } else if (SCRIPT_DIR.find("/scripts") != string::npos &&
                   SCRIPT_DIR.find("/cc-server") == string::npos) {
            // If we're in scripts, go up one level
            size_t pos = SCRIPT_DIR.find("/scripts");
            SCRIPT_DIR = SCRIPT_DIR.substr(0, pos);
        }
    }
    ROOT_ENV_FILE = SCRIPT_DIR + "/.env";
}

// Trim string
string trim(const string& str) {
    size_t first = str.find_first_not_of(" \t");
    if (first == string::npos) return "";
    size_t last = str.find_last_not_of(" \t");
    return str.substr(first, (last - first + 1));
}

// Read value from .env file
string read_env_value(const string& file_path, const string& key) {
    ifstream file(file_path);
    if (!file.is_open()) return "";

    string line;
    while (getline(file, line)) {
        line = trim(line);
        if (line.empty() || line[0] == '#') continue;

        size_t pos = line.find('=');
        if (pos == string::npos) continue;

        string file_key = trim(line.substr(0, pos));
        if (file_key == key) {
            string value = line.substr(pos + 1);
            value = trim(value);
            if (!value.empty() && (value[0] == '"' || value[0] == '\'')) {
                value = value.substr(1);
            }
            if (!value.empty() && (value.back() == '"' || value.back() == '\'')) {
                value.pop_back();
            }
            return trim(value);
        }
    }
    return "";
}

// Write value to .env file
void write_env_value(const string& file_path, const string& key, const string& value) {
    vector<string> lines;
    bool found = false;

    ifstream in_file(file_path);
    if (in_file.is_open()) {
        string line;
        while (getline(in_file, line)) {
            string trimmed = trim(line);
            if (trimmed.empty() || trimmed[0] == '#') {
                lines.push_back(line);
                continue;
            }

            size_t pos = trimmed.find('=');
            if (pos != string::npos) {
                string line_key = trim(trimmed.substr(0, pos));
                if (line_key == key) {
                    lines.push_back(key + "=" + value);
                    found = true;
                } else {
                    lines.push_back(line);
                }
            } else {
                lines.push_back(line);
            }
        }
        in_file.close();
    }

    if (!found) {
        lines.push_back(key + "=" + value);
    }

    ofstream out_file(file_path);
    if (out_file.is_open()) {
        for (const auto& line : lines) {
            out_file << line << "\n";
        }
        out_file.close();
    }
}

// Generate random secret (simplified - using openssl command)
string generate_secret(int length = 32) {
    FILE* pipe = popen(("openssl rand -base64 " + to_string(length)).c_str(), "r");
    if (!pipe) return "";
    char buffer[128];
    string result = "";
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }
    pclose(pipe);
    result.erase(remove(result.begin(), result.end(), '\n'), result.end());
    result.erase(remove(result.begin(), result.end(), '\r'), result.end());
    return result.substr(0, length);
}

// Generate hex secret
string generate_hex_secret(int length = 32) {
    FILE* pipe = popen(("openssl rand -hex " + to_string(length)).c_str(), "r");
    if (!pipe) return "";
    char buffer[128];
    string result = "";
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        result += buffer;
    }
    pclose(pipe);
    result.erase(remove(result.begin(), result.end(), '\n'), result.end());
    result.erase(remove(result.begin(), result.end(), '\r'), result.end());
    return result.substr(0, length);
}

// Default generators
string default_postgres_db() { return "fleet_cc"; }
string default_postgres_user() { return "postgres"; }
// Generate PostgreSQL password using hex (URL-safe, no special characters)
string default_postgres_password() {
    // Use hex instead of base64 to avoid URL encoding issues
    // Hex produces only 0-9, a-f characters which are URL-safe
    return generate_hex_secret(32);
}
string default_jwt_secret() { return generate_secret(32); }
string default_session_secret() { return generate_secret(32); }
string default_device_token() { return generate_hex_secret(32); }
string default_db_enc_key() { return generate_hex_secret(32); }
string default_supabase_url() { return "http://localhost:8000"; }
string default_api_external_url() { return "http://localhost:9999"; }
string default_next_public_api_url() { return "http://localhost:3001"; }
string default_next_public_supabase_url() { return "http://localhost:9999"; }
string default_api_port() { return "3001"; }
string default_node_env() { return "development"; }
string default_secure_channels() { return "true"; }
string default_rsync_target_path() { return "/var/fleet-data"; }
string default_hq_wifi_ssid() { return "HQNetwork"; }

// Get default value by function name
string get_default_value(const string& generator_name) {
    if (generator_name == "default_postgres_db") return default_postgres_db();
    if (generator_name == "default_postgres_user") return default_postgres_user();
    if (generator_name == "default_postgres_password") return default_postgres_password();
    if (generator_name == "default_jwt_secret") return default_jwt_secret();
    if (generator_name == "default_session_secret") return default_session_secret();
    if (generator_name == "default_device_token") return default_device_token();
    if (generator_name == "default_db_enc_key") return default_db_enc_key();
    if (generator_name == "default_supabase_url") return default_supabase_url();
    if (generator_name == "default_api_external_url") return default_api_external_url();
    if (generator_name == "default_next_public_api_url") return default_next_public_api_url();
    if (generator_name == "default_next_public_supabase_url") return default_next_public_supabase_url();
    if (generator_name == "default_api_port") return default_api_port();
    if (generator_name == "default_node_env") return default_node_env();
    if (generator_name == "default_secure_channels") return default_secure_channels();
    if (generator_name == "default_rsync_target_path") return default_rsync_target_path();
    if (generator_name == "default_hq_wifi_ssid") return default_hq_wifi_ssid();
    return "";
}

// Missing variable structure
struct MissingVar {
    string name;
    string file_path;
    string description;
};

// Check required environment variables
vector<MissingVar> check_required_variables() {
    vector<MissingVar> missing;

    vector<pair<string, string>> required_vars = {
        {"POSTGRES_DB", "PostgreSQL database name"},
        {"POSTGRES_USER", "PostgreSQL username"},
        {"POSTGRES_PASSWORD", "PostgreSQL password"},
        {"JWT_SECRET", "JWT secret for token signing"},
        {"SESSION_SECRET", "Session secret"},
        {"DEVICE_REGISTRATION_TOKEN", "Device registration token"},
        {"DB_ENC_KEY", "Database encryption key for Realtime"},
        {"SUPABASE_URL", "Supabase URL"},
        {"API_EXTERNAL_URL", "External API URL for GoTrue"},
        {"NEXT_PUBLIC_API_URL", "Public API URL"},
        {"NEXT_PUBLIC_SUPABASE_URL", "Public Supabase URL"},
        {"SUPABASE_SERVICE_ROLE_KEY", "Supabase service role key"},
        {"NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anonymous key"},
        {"API_PORT", "API server port"},
        {"NODE_ENV", "Node environment"}
    };

    for (const auto& var : required_vars) {
        string value = read_env_value(ROOT_ENV_FILE, var.first);
        if (value.empty()) {
            missing.push_back({var.first, ROOT_ENV_FILE, var.second});
        }
    }

    return missing;
}

// Prompt for single environment variable
string prompt_env_var_interactive(const string& var_name, const string& description,
                                 const string& default_generator_name, bool sensitive) {
    auto screen = ScreenInteractive::Fullscreen();
    string input = "";
    string result = "";
    bool submitted = false;

    string existing_value = read_env_value(ROOT_ENV_FILE, var_name);
    string default_value = get_default_value(default_generator_name);

    string display_default = default_value;
    if (sensitive && !existing_value.empty()) {
        display_default = "[existing hidden value]";
    } else if (!existing_value.empty()) {
        display_default = existing_value;
    } else if (default_value.empty()) {
        display_default = "[leave blank to skip]";
    }

    Component input_component = Input(&input, "");

    Component component = Renderer(Container::Vertical({
        input_component
    }), [&] {
        Elements elements;
        elements.push_back(text(var_name) | bold | color(Color::Cyan));
        elements.push_back(text(description));

        if (!existing_value.empty() && sensitive) {
            elements.push_back(text("Current: [hidden]"));
            elements.push_back(text("Enter new value (or press Enter to keep current):"));
        } else {
            elements.push_back(text("Value [" + display_default + "]:"));
        }

        elements.push_back(separator());
        elements.push_back(input_component->Render() | border);
        elements.push_back(text("Press Enter to submit, Escape to cancel"));

        return vbox(elements);
    });

    component |= CatchEvent([&](Event e) {
        if (e == Event::CtrlC) {
            should_exit = true;
            screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        if (e == Event::Return) {
            submitted = true;
            if (input.empty()) {
                if (!existing_value.empty()) {
                    result = existing_value;
                } else {
                    result = default_value;
                }
            } else {
                result = input;
            }
            screen.ExitLoopClosure()();
            return true;
        }
        if (e == Event::Escape) {
            should_exit = true;
            screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        return false;
    });

    screen.Loop(component);

    if (!result.empty() || (!existing_value.empty() && input.empty())) {
        if (result.empty() && !existing_value.empty()) {
            result = existing_value;
        }
        write_env_value(ROOT_ENV_FILE, var_name, result);
    }

    return result;
}

// Setup missing variables only
void setup_missing_variables(const vector<MissingVar>& missing_vars) {
    map<string, pair<string, bool>> var_config = {
        {"POSTGRES_DB", {"default_postgres_db", false}},
        {"POSTGRES_USER", {"default_postgres_user", false}},
        {"POSTGRES_PASSWORD", {"default_postgres_password", true}},
        {"JWT_SECRET", {"default_jwt_secret", true}},
        {"SESSION_SECRET", {"default_session_secret", true}},
        {"DEVICE_REGISTRATION_TOKEN", {"default_device_token", true}},
        {"DB_ENC_KEY", {"default_db_enc_key", true}},
        {"SUPABASE_URL", {"default_supabase_url", false}},
        {"API_EXTERNAL_URL", {"default_api_external_url", false}},
        {"NEXT_PUBLIC_API_URL", {"default_next_public_api_url", false}},
        {"NEXT_PUBLIC_SUPABASE_URL", {"default_next_public_supabase_url", false}},
        {"SUPABASE_SERVICE_ROLE_KEY", {"default_jwt_secret", true}},
        {"NEXT_PUBLIC_SUPABASE_ANON_KEY", {"default_jwt_secret", true}},
        {"API_PORT", {"default_api_port", false}},
        {"NODE_ENV", {"default_node_env", false}}
    };

    for (const auto& var : missing_vars) {
        auto it = var_config.find(var.name);
        if (it != var_config.end()) {
            prompt_env_var_interactive(var.name, var.description, it->second.first, it->second.second);
        } else {
            prompt_env_var_interactive(var.name, var.description, "", false);
        }
    }

    // Sync JWT_SECRET if set
    string jwt_secret = read_env_value(ROOT_ENV_FILE, "JWT_SECRET");
    if (!jwt_secret.empty()) {
        string supabase_key = read_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY");
        string anon_key = read_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
        if (supabase_key.empty()) {
            write_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY", jwt_secret);
        }
        if (anon_key.empty()) {
            write_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt_secret);
        }
    }
}

// Show message screen
void show_message_screen(const string& title, const vector<string>& messages, bool wait = true) {
    auto screen = ScreenInteractive::Fullscreen();

    Component component = Renderer([&] {
        Elements elements;
        elements.push_back(text(title) | bold | center);
        elements.push_back(separator());
        for (const auto& msg : messages) {
            elements.push_back(text(msg));
        }
        if (wait) {
            elements.push_back(separator());
            elements.push_back(text("Press Enter to continue...") | center);
        }
        return vbox(elements) | border;
    });

        component |= CatchEvent([&](Event e) {
            if (e == Event::CtrlC) {
                should_exit = true;
                screen.ExitLoopClosure()();
                restore_terminal();
                _exit(1);
            }
            if (wait && (e == Event::Return || e == Event::Character(' '))) {
                screen.ExitLoopClosure()();
                return true;
            }
            return false;
        });

    screen.Loop(component);
}

// Run command and show output in console (non-interactive)
int run_command_console(const string& cmd, vector<string>& output_lines) {
    vector<string> lines;
    lines.push_back("Running: " + cmd);
    lines.push_back("");

    cout << "=== " << cmd << " ===" << endl;
    cout.flush();

    FILE* pipe = popen((cmd + " 2>&1").c_str(), "r");
    if (!pipe) {
        cerr << "❌ Failed to execute command" << endl;
        return -1;
    }

    char buffer[2048];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr && !should_exit) {
        string line(buffer);
        // Remove trailing newline
        if (!line.empty() && line.back() == '\n') {
            line.pop_back();
        }
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (!line.empty()) {
            lines.push_back(line);
            cout << line << endl;
            cout.flush();
        }
    }

    int exit_code = pclose(pipe);

    if (should_exit) {
        cout << "\n⚠️ Command interrupted by user" << endl;
        exit_code = 130; // Standard exit code for SIGINT
    }

    output_lines = lines;
    return exit_code;
}

// Run command and show output in a scrollable window
int run_command_with_output(const string& title, const string& cmd, vector<string>& output_lines, bool show_live = true) {
    auto screen = ScreenInteractive::Fullscreen();

    vector<string> lines;
    lines.push_back("Running: " + cmd);
    lines.push_back("");

    bool command_done = false;
    int exit_code = -1;
    atomic<bool> should_quit(false);

    // Not used but kept for future scrolling enhancement

    // Run command in background thread
    thread cmd_thread([&]() {
        FILE* pipe = popen((cmd + " 2>&1").c_str(), "r");
        if (!pipe) {
            lines.push_back("❌ Failed to execute command");
            command_done = true;
            exit_code = -1;
            screen.PostEvent(Event::Custom);
            return;
        }

        char buffer[2048];
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr && !should_quit && !should_exit) {
            string line(buffer);
            // Remove trailing newline
            if (!line.empty() && line.back() == '\n') {
                line.pop_back();
            }
            if (!line.empty() && line.back() == '\r') {
                line.pop_back();
            }
            if (!line.empty()) {
                lines.push_back(line);

                // Limit lines to prevent memory issues (keep last 2000 lines)
                if (lines.size() > 2000) {
                    lines.erase(lines.begin() + 2, lines.begin() + 3); // Keep header, remove oldest
                }

                // Trigger screen update
                screen.PostEvent(Event::Custom);
            }

            // Small delay to allow UI updates
            this_thread::sleep_for(chrono::milliseconds(10));
        }

        if (should_exit) {
            pclose(pipe);
            lines.push_back("");
            lines.push_back("⚠️ Command interrupted by Ctrl-C");
            command_done = true;
            exit_code = 130;
            screen.PostEvent(Event::Custom);
            return;
        }

        if (!should_quit) {
            exit_code = pclose(pipe);
        } else {
            pclose(pipe);
            lines.push_back("");
            lines.push_back("⚠️ Command cancelled by user");
        }

        command_done = true;
        screen.PostEvent(Event::Custom);
    });

    // Component for displaying output
    Component output_component = Renderer([&] {
        Elements elements;
        elements.push_back(text(title) | bold | center | color(Color::Cyan));
        elements.push_back(separator());

        // Create scrollable content
        Elements content;
        int display_start = 0;
        int max_display_lines = screen.dimy() - 8; // Leave space for header/footer

        if (lines.size() > (size_t)max_display_lines) {
            display_start = max(0, (int)lines.size() - max_display_lines);
        }

        for (size_t i = display_start; i < lines.size(); i++) {
            content.push_back(text(lines[i]));
        }

        if (!command_done) {
            content.push_back(text("") | color(Color::Yellow));
            content.push_back(text("⏳ Running... (Press 'q' to cancel)") | center | color(Color::Yellow));
        } else {
            content.push_back(text(""));
            if (exit_code == 0) {
                content.push_back(text("✅ Command completed successfully") | center | color(Color::Green));
            } else {
                content.push_back(text("❌ Command failed (exit code: " + to_string(exit_code) + ")") | center | color(Color::Red));
            }
            content.push_back(text("Press Enter to continue...") | center);
        }

        elements.push_back(vbox(content) | vscroll_indicator | frame);
        elements.push_back(separator());

        return vbox(elements) | border;
    });

    // Handle input
    Component handler = output_component | CatchEvent([&](Event e) {
        if (should_exit) {
            screen.ExitLoopClosure()();
            return true;
        }
        if (command_done && (e == Event::Return || e == Event::Character(' '))) {
            screen.ExitLoopClosure()();
            return true;
        }
        if ((e == Event::Character('q') || e == Event::Escape || e == Event::CtrlC) && !command_done) {
            should_quit = true;
            should_exit = true;
            screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        if (e == Event::CtrlC) {
            should_exit = true;
            screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        return false;
    });

    screen.Loop(handler);

    should_quit = true;
    if (cmd_thread.joinable()) {
        cmd_thread.join();
    }

    // Copy output lines for return
    output_lines = lines;

    return exit_code;
}

// Verify function
void run_verify() {
    auto missing = check_required_variables();

    vector<string> messages;
    if (missing.empty()) {
        messages.push_back("✅ All required environment variables are set!");
        show_message_screen("Checking Required Environment Variables", messages);
        return;
    }

    messages.push_back("❌ Found " + to_string(missing.size()) + " missing required environment variable(s):");
    messages.push_back("");
    messages.push_back("Missing Variables:");
    messages.push_back("");

    for (const auto& var : missing) {
        messages.push_back("  ✗ " + var.name);
        messages.push_back("     Required in: " + var.file_path);
        messages.push_back("     Description: " + var.description);
        messages.push_back("");
    }

    auto screen = ScreenInteractive::Fullscreen();
    int selected = 0;
    vector<string> options = {"Yes", "No"};

    Component menu = Menu(&options, &selected);
    Component component = Renderer(Container::Vertical({menu}), [&] {
        Elements elements;
        elements.push_back(text("Checking Required Environment Variables") | bold | center);
        elements.push_back(separator());
        for (const auto& msg : messages) {
            elements.push_back(text(msg));
        }
        elements.push_back(separator());
        elements.push_back(text("Would you like to fix these issues now?") | center);
        elements.push_back(separator());
        elements.push_back(menu->Render());
        return vbox(elements) | border;
    });

    component |= CatchEvent([&](Event e) {
        if (e == Event::Return) {
            if (selected == 0) { // Yes
                screen.ExitLoopClosure()();
                setup_missing_variables(missing);

                // Re-verify
                auto recheck = check_required_variables();
                vector<string> recheck_messages;
                if (recheck.empty()) {
                    recheck_messages.push_back("✅ All variables are now configured correctly!");
                } else {
                    recheck_messages.push_back("⚠ Some variables are still missing.");
                }
                show_message_screen("Verification Complete", recheck_messages);
            } else {
                screen.ExitLoopClosure()();
            }
            return true;
        }
        return false;
    });

    screen.Loop(component);
}

// Setup function
// Multi-input setup screen with all variables visible
void run_setup() {
    // Check Docker
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed. Please install Docker first."});
        return;
    }

    if (system("docker compose version >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker Compose is not installed. Please install Docker Compose first."});
        return;
    }

    // Ensure .env file exists
    ifstream test_file(ROOT_ENV_FILE);
    if (!test_file.good()) {
        ifstream example_file(SCRIPT_DIR + "/.env.example");
        if (example_file.good()) {
            ofstream out_file(ROOT_ENV_FILE);
            out_file << example_file.rdbuf();
            out_file.close();
        } else {
            ofstream out_file(ROOT_ENV_FILE);
            out_file.close();
        }
    }
    test_file.close();

    // Define all variables with their metadata
    struct VarDef {
        string name;
        string description;
        string default_gen;
        bool sensitive;
        string section;
    };

    vector<VarDef> vars = {
        {"POSTGRES_DB", "PostgreSQL database name", "default_postgres_db", false, "Database"},
        {"POSTGRES_USER", "PostgreSQL username", "default_postgres_user", false, "Database"},
        {"POSTGRES_PASSWORD", "PostgreSQL password", "default_postgres_password", true, "Database"},
        {"JWT_SECRET", "JWT token signing secret", "default_jwt_secret", true, "Security"},
        {"SESSION_SECRET", "Session secret", "default_session_secret", true, "Security"},
        {"DEVICE_REGISTRATION_TOKEN", "Device registration token", "default_device_token", true, "Security"},
        {"DB_ENC_KEY", "Database encryption key", "default_db_enc_key", true, "Security"},
        {"SUPABASE_URL", "Supabase URL", "default_supabase_url", false, "Supabase"},
        {"API_EXTERNAL_URL", "External API URL for GoTrue", "default_api_external_url", false, "Supabase"},
        {"NEXT_PUBLIC_SUPABASE_URL", "Public Supabase URL", "default_next_public_supabase_url", false, "Supabase"},
        {"API_PORT", "API server port", "default_api_port", false, "API"},
        {"NEXT_PUBLIC_API_URL", "Public API URL", "default_next_public_api_url", false, "API"},
        {"NODE_ENV", "Node environment", "default_node_env", false, "API"},
        {"SECURE_CHANNELS", "Enable secure channels", "default_secure_channels", false, "Optional"},
        {"RSYNC_TARGET_PATH", "Rsync data storage path", "default_rsync_target_path", false, "Optional"},
        {"HQ_WIFI_SSID", "Headquarters WiFi SSID", "default_hq_wifi_ssid", false, "Optional"}
    };

    // Initialize input fields with current or default values
    vector<string> inputs(vars.size());

    for (size_t i = 0; i < vars.size(); i++) {
        string existing = read_env_value(ROOT_ENV_FILE, vars[i].name);
        if (!existing.empty()) {
            inputs[i] = vars[i].sensitive ? "[hidden]" : existing;
        } else {
            inputs[i] = get_default_value(vars[i].default_gen);
        }
    }

    auto screen = ScreenInteractive::Fullscreen();
    int selected_field = 0;
    bool cancelled = false;

    // Create input components - each bound to its own unique string in inputs vector
    vector<Component> input_components;
    for (size_t i = 0; i < vars.size(); i++) {
        // Each Input component gets a unique pointer to inputs[i]
        // This ensures each field is completely independent
        input_components.push_back(Input(&inputs[i], ""));
    }

    // Create vertical container with all input components directly (not wrapped)
    // This ensures proper focus management and independent input handling
    Component all_inputs = Container::Vertical(input_components);


    // Main renderer that wraps everything and displays labels
    Component renderer = Renderer(all_inputs, [&] {
        // Set cursor color to red when any input is focused
        for (size_t i = 0; i < input_components.size(); i++) {
            if (input_components[i]->Focused()) {
                // Set cursor color to red using terminal escape sequence
                // This works with xterm-compatible terminals (xterm, iTerm2, etc.)
                cout << "\033]12;red\007";  // Set cursor color to red
                cout.flush();
                break;
            }
        }

        Elements elements;
        elements.push_back(text("Fleet Command & Control Server Setup") | bold | center | color(Color::Green));
        elements.push_back(text("Configure Environment Variables") | center);
        elements.push_back(separator());
        elements.push_back(text("Use ↑↓ to navigate, Tab/Enter to move to next field, Escape to cancel") | center | dim);
        elements.push_back(separator());

        // Find which field is currently focused for scroll calculation
        int focused_idx = 0;
        for (size_t i = 0; i < input_components.size(); i++) {
            if (input_components[i]->Focused()) {
                focused_idx = i;
                selected_field = i;
                break;
            }
        }

        // Calculate visible range to keep focused field in view
        int lines_per_field = 5;
        int header_lines = 5;
        int footer_lines = 2;
        int screen_height = Terminal::Size().dimy;
        int available_height = screen_height - header_lines - footer_lines;
        int visible_fields = max(3, available_height / lines_per_field);

        int start_idx = max(0, focused_idx - visible_fields / 2);
        int end_idx = min((int)input_components.size(), start_idx + visible_fields);

        if (end_idx == (int)input_components.size()) {
            start_idx = max(0, (int)input_components.size() - visible_fields);
        }
        start_idx = max(0, start_idx);

        // Render visible fields with labels
        Elements visible_form;
        string current_section = "";
        for (int i = start_idx; i < end_idx; i++) {
            // Section header
            if (vars[i].section != current_section) {
                current_section = vars[i].section;
                visible_form.push_back(text(""));
                visible_form.push_back(text("─── " + current_section + " ───") | bold | color(Color::Cyan));
            }

            // Field name and description
            bool is_focused = input_components[i]->Focused();
            auto field_text = text(vars[i].name + ":") | (is_focused ? bold | color(Color::Yellow) : color(Color::White));
            visible_form.push_back(field_text);
            visible_form.push_back(text("  " + vars[i].description) | dim);

            // Input field with highlighting - let FTXUI handle cursor rendering
            auto input_render = input_components[i]->Render();
            if (is_focused) {
                input_render = input_render | borderDouble | color(Color::YellowLight) | focus;
            } else {
                input_render = input_render | border | color(Color::White);
            }
            visible_form.push_back(input_render);
            visible_form.push_back(text(""));
        }

        // Add scroll indicator
        if (start_idx > 0 || end_idx < (int)input_components.size()) {
            string scroll_info = "(" + to_string(focused_idx + 1) + "/" + to_string(input_components.size()) + ")";
            if (start_idx > 0) {
                scroll_info = "↑ " + scroll_info;
            }
            if (end_idx < (int)input_components.size()) {
                scroll_info = scroll_info + " ↓";
            }
            visible_form.push_back(text(""));
            visible_form.push_back(text(scroll_info) | center | dim);
        }

        elements.push_back(vbox(visible_form) | vscroll_indicator | frame | yflex);
        elements.push_back(separator());
        elements.push_back(text("Press 's' or Enter on last field to save, Escape to cancel (Ctrl-C to force exit)") | center | dim);

        return vbox(elements) | border;
    });

    // Handle save action and navigation
    Component save_handler = renderer | CatchEvent([&](Event e) {
        if (e == Event::CtrlC) {
            should_exit = true;
            screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        if (e == Event::Escape) {
            cancelled = true;
            screen.ExitLoopClosure()();
            return true;
        }
        // Save on 's' key or Enter when on last field
        if (e == Event::Character('s') || e == Event::Character('S')) {
            // Find which field is currently focused
            for (size_t i = 0; i < input_components.size(); i++) {
                if (input_components[i]->Focused()) {
                    selected_field = i;
                    break;
                }
            }

            // Save all values
            for (size_t i = 0; i < vars.size(); i++) {
                string value = inputs[i];

                // Handle sensitive fields
                if (vars[i].sensitive && value == "[hidden]") {
                    // Keep existing value
                    continue;
                }

                // Use default if empty
                if (value.empty()) {
                    value = get_default_value(vars[i].default_gen);
                }

                write_env_value(ROOT_ENV_FILE, vars[i].name, value);
            }

            // Handle JWT_SECRET synchronization
            string jwt_secret = inputs[3]; // JWT_SECRET index
            if (jwt_secret != "[hidden]" && !jwt_secret.empty()) {
                write_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY", jwt_secret);
                write_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt_secret);
            }

            screen.ExitLoopClosure()();
            return true;
        }
        // Track focused component for scroll calculation (don't intercept, let Container handle it)
        // The Container will automatically move focus, we just track it in the render function
        // Handle Enter on last field to save
        if (e == Event::Return) {
            // Check if we're on the last field
            bool on_last = false;
            for (size_t i = 0; i < input_components.size(); i++) {
                if (input_components[i]->Focused()) {
                    selected_field = i;
                    on_last = (i == vars.size() - 1);
                    break;
                }
            }

            if (on_last) {
                // Save all values (same as 's' key)
                for (size_t i = 0; i < vars.size(); i++) {
                    string value = inputs[i];

                    if (vars[i].sensitive && value == "[hidden]") {
                        continue;
                    }

                    if (value.empty()) {
                        value = get_default_value(vars[i].default_gen);
                    }

                    write_env_value(ROOT_ENV_FILE, vars[i].name, value);
                }

                string jwt_secret = inputs[3];
                if (jwt_secret != "[hidden]" && !jwt_secret.empty()) {
                    write_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY", jwt_secret);
                    write_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt_secret);
                }

                screen.ExitLoopClosure()();
                return true;
            }
            // Otherwise let the input handle Enter (does nothing by default, or we could move to next)
        }
        return false;
    });

    // Wrap renderer with save handler
    Component final_component = Renderer(save_handler, [&] {
        return renderer->Render();
    });

    screen.Loop(final_component);

    if (cancelled || should_exit) {
        show_message_screen("Setup Cancelled", {
            "Setup has been cancelled.",
            "No changes have been saved."
        });
        return;
    }

    // Ask about npm install
    auto npm_screen = ScreenInteractive::Fullscreen();
    int npm_selected = 0;
    vector<string> npm_options = {"Yes", "No"};
    Component npm_menu = Menu(&npm_options, &npm_selected);
    Component npm_component = Renderer(Container::Vertical({npm_menu}), [&] {
        return vbox({
            text("Would you like to install npm dependencies now? (Y/n)") | center,
            separator(),
            npm_menu->Render()
        }) | border;
    });

    npm_component |= CatchEvent([&](Event e) {
        if (e == Event::CtrlC) {
            should_exit = true;
            npm_screen.ExitLoopClosure()();
            restore_terminal();
            _exit(1);
        }
        if (e == Event::Return) {
            if (npm_selected == 0) {
                npm_screen.ExitLoopClosure()();
                // Install backend dependencies
                vector<string> output_lines;
                string cmd = "cd " + SCRIPT_DIR + "/backend && npm install";
                int result = run_command_with_output("Installing Backend Dependencies", cmd, output_lines);

                if (result == 0 && !should_exit) {
                    // Install frontend dependencies
                    cmd = "cd " + SCRIPT_DIR + "/frontend && npm install";
                    result = run_command_with_output("Installing Frontend Dependencies", cmd, output_lines);
                }

                if (result != 0 && !should_exit) {
                    show_message_screen("Warning", {
                        "⚠️ Some npm dependencies failed to install.",
                        "You can install them manually later."
                    });
                }
            } else {
                npm_screen.ExitLoopClosure()();
            }
            return true;
        }
        return false;
    });

    npm_screen.Loop(npm_component);

    if (should_exit) return;

    show_message_screen("Setup Complete", {
        "✅ Environment configuration complete!",
        "",
        "Next steps:",
        "  1. Review environment configuration: " + ROOT_ENV_FILE,
        "  2. Build and start services using options 3 (Build) and 5 (Start)"
    });
}

// Build function
void run_build() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed."});
        return;
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose build";
    int result = run_command_with_output("Building Docker Images", cmd, output_lines);

    vector<string> messages;
    if (result == 0) {
        messages.push_back("✅ All Docker images built successfully!");
    } else {
        messages.push_back("❌ Build failed. Check the output above for errors.");
        messages.push_back("");
        messages.push_back("Exit code: " + to_string(result));
    }
    show_message_screen("Build Complete", messages);
}

// Test function
void run_test() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed."});
        return;
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose ps";
    int result = run_command_with_output("Testing Container Health", cmd, output_lines);

    // Also check individual services
    vector<string> services = {"postgres", "api", "frontend", "auth", "realtime", "meta", "studio"};
    vector<string> messages;
    messages.push_back("Container Status:");
    messages.push_back("");

    bool all_healthy = true;
    for (const auto& service : services) {
        string status_cmd = "cd " + SCRIPT_DIR + " && docker compose ps " + service + " --format json";
        FILE* status_pipe = popen(status_cmd.c_str(), "r");
        string status_json = "";
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), status_pipe) != nullptr) {
            status_json += buffer;
        }
        pclose(status_pipe);

        if (status_json.find("\"State\":\"running\"") != string::npos) {
            messages.push_back("  ✓ " + service + " - running");
        } else {
            messages.push_back("  ✗ " + service + " - not running");
            all_healthy = false;
        }
    }

    messages.push_back("");
    if (all_healthy) {
        messages.push_back("✅ All containers are healthy!");
    } else {
        messages.push_back("❌ Some containers are not healthy.");
    }

    show_message_screen("Container Health Check", messages);
}

// Start function
void run_start() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed."});
        return;
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose up -d";
    int result = run_command_with_output("Starting Containers", cmd, output_lines);

    vector<string> messages;
    if (result == 0) {
        messages.push_back("✅ All containers started successfully!");
        messages.push_back("");
        messages.push_back("Access services at:");
        messages.push_back("  - Frontend: http://localhost:3000");
        messages.push_back("  - API: http://localhost:3001");
        messages.push_back("  - Supabase Studio: http://localhost:8080");
        messages.push_back("  - Supabase Auth: http://localhost:9999");
        messages.push_back("");
        messages.push_back("View logs: docker compose logs -f");
        messages.push_back("View status: docker compose ps");
    } else {
        messages.push_back("❌ Failed to start containers. Check the output above for errors.");
        messages.push_back("");
        messages.push_back("Exit code: " + to_string(result));
    }
    show_message_screen("Start Complete", messages);
}

// Main menu loop
void run_main_menu() {
    auto screen = ScreenInteractive::Fullscreen();
    bool running = true;

    while (running) {
        int selected = 0;
        vector<string> menu_entries = {
            "Setup        - Configure environment variables",
            "Verify       - Check environment configuration",
            "Build        - Build Docker images",
            "Test         - Test container health and startup",
            "Start        - Start all containers",
            "Exit         - Exit the menu"
        };

        Component menu = Menu(&menu_entries, &selected);
        Component component = Renderer(Container::Vertical({menu}), [&] {
            return vbox({
                text("Carputer") | bold | center | color(Color::Green),
                text("Fleet CC Server") | bold | center,
                separator(),
                text("Use arrow keys to navigate, Enter to select:") | color(Color::Yellow),
                separator(),
                menu->Render()
            }) | border;
        });

        bool action_taken = false;
        component |= CatchEvent([&](Event e) {
            if (e == Event::CtrlC) {
                should_exit = true;
                screen.ExitLoopClosure()();
                restore_terminal();
                _exit(1);
            }
            if (e == Event::Return || e == Event::Character(' ')) {
                screen.ExitLoopClosure()();
                action_taken = true;

                switch (selected) {
                    case 0: // Setup
                        run_setup();
                        break;
                    case 1: // Verify
                        run_verify();
                        break;
                    case 2: // Build
                        run_build();
                        break;
                    case 3: // Test
                        run_test();
                        break;
                    case 4: // Start
                        run_start();
                        break;
                    case 5: // Exit
                        running = false;
                        break;
                }
                return true;
            }
            return false;
        });

        screen.Loop(component);

        if (!running) break;
    }
}

// Non-interactive versions of functions
void run_setup_noninteractive() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        cerr << "❌ Docker is not installed. Please install Docker first." << endl;
        exit(1);
    }

    if (system("docker compose version >/dev/null 2>&1") != 0) {
        cerr << "❌ Docker Compose is not installed. Please install Docker Compose first." << endl;
        exit(1);
    }

    cout << "Fleet Command & Control Server Setup" << endl;
    cout << "=====================================" << endl;
    cout << "Running in non-interactive mode. All variables will use defaults if not set." << endl;
    cout << endl;

    // Ensure .env file exists
    ifstream test_file(ROOT_ENV_FILE);
    if (!test_file.good()) {
        ifstream example_file(SCRIPT_DIR + "/.env.example");
        if (example_file.good()) {
            ofstream out_file(ROOT_ENV_FILE);
            out_file << example_file.rdbuf();
            out_file.close();
        } else {
            ofstream out_file(ROOT_ENV_FILE);
            out_file.close();
        }
    }

    // Check what's missing and use defaults
    auto missing = check_required_variables();
    if (!missing.empty()) {
        map<string, pair<string, bool>> var_config = {
            {"POSTGRES_DB", {"default_postgres_db", false}},
            {"POSTGRES_USER", {"default_postgres_user", false}},
            {"POSTGRES_PASSWORD", {"default_postgres_password", true}},
            {"JWT_SECRET", {"default_jwt_secret", true}},
            {"SESSION_SECRET", {"default_session_secret", true}},
            {"DEVICE_REGISTRATION_TOKEN", {"default_device_token", true}},
            {"DB_ENC_KEY", {"default_db_enc_key", true}},
            {"SUPABASE_URL", {"default_supabase_url", false}},
            {"API_EXTERNAL_URL", {"default_api_external_url", false}},
            {"NEXT_PUBLIC_API_URL", {"default_next_public_api_url", false}},
            {"NEXT_PUBLIC_SUPABASE_URL", {"default_next_public_supabase_url", false}},
            {"SUPABASE_SERVICE_ROLE_KEY", {"default_jwt_secret", true}},
            {"NEXT_PUBLIC_SUPABASE_ANON_KEY", {"default_jwt_secret", true}},
            {"API_PORT", {"default_api_port", false}},
            {"NODE_ENV", {"default_node_env", false}}
        };

        for (const auto& var : missing) {
            auto it = var_config.find(var.name);
            if (it != var_config.end()) {
                string default_val = get_default_value(it->second.first);
                write_env_value(ROOT_ENV_FILE, var.name, default_val);
                cout << "✓ Set " << var.name << " to default value" << endl;
            }
        }

        // Sync JWT_SECRET if set
        string jwt_secret = read_env_value(ROOT_ENV_FILE, "JWT_SECRET");
        if (!jwt_secret.empty()) {
            string supabase_key = read_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY");
            if (supabase_key.empty()) {
                write_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY", jwt_secret);
            }
            string anon_key = read_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
            if (anon_key.empty()) {
                write_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt_secret);
            }
        }
    }

    cout << "\n✅ Setup complete!" << endl;
}

void run_verify_noninteractive() {
    auto missing = check_required_variables();
    if (missing.empty()) {
        cout << "✅ All required environment variables are set!" << endl;
        exit(0);
    } else {
        cout << "❌ Found " << missing.size() << " missing required environment variable(s)" << endl;
        for (const auto& var : missing) {
            cout << "  ✗ " << var.name << endl;
            cout << "     Required in: " << var.file_path << endl;
            cout << "     Description: " << var.description << endl;
        }
        exit(1);
    }
}

void run_build_noninteractive() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        cerr << "❌ Docker is not installed." << endl;
        exit(1);
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose build";
    int result = run_command_console(cmd, output_lines);

    if (result == 0) {
        cout << "✅ All Docker images built successfully!" << endl;
        exit(0);
    } else {
        cerr << "❌ Build failed with exit code: " << result << endl;
        exit(result);
    }
}

void run_test_noninteractive() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        cerr << "❌ Docker is not installed." << endl;
        exit(1);
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose ps";
    int result = run_command_console(cmd, output_lines);

    // Check individual services
    vector<string> services = {"postgres", "api", "frontend", "auth", "realtime", "meta", "studio"};
    bool all_healthy = true;

    cout << "\nContainer Status:" << endl;
    for (const auto& service : services) {
        string status_cmd = "cd " + SCRIPT_DIR + " && docker compose ps " + service + " --format json";
        FILE* status_pipe = popen(status_cmd.c_str(), "r");
        string status_json = "";
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), status_pipe) != nullptr) {
            status_json += buffer;
        }
        pclose(status_pipe);

        if (status_json.find("\"State\":\"running\"") != string::npos) {
            cout << "  ✓ " << service << " - running" << endl;
        } else {
            cout << "  ✗ " << service << " - not running" << endl;
            all_healthy = false;
        }
    }

    if (all_healthy) {
        cout << "\n✅ All containers are healthy!" << endl;
        exit(0);
    } else {
        cout << "\n❌ Some containers are not healthy." << endl;
        exit(1);
    }
}

void run_start_noninteractive() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        cerr << "❌ Docker is not installed." << endl;
        exit(1);
    }

    vector<string> output_lines;
    string cmd = "cd " + SCRIPT_DIR + " && docker compose up -d";
    int result = run_command_console(cmd, output_lines);

    if (result == 0) {
        cout << "\n✅ All containers started successfully!" << endl;
        cout << "\nAccess services at:" << endl;
        cout << "  - Frontend: http://localhost:3000" << endl;
        cout << "  - API: http://localhost:3001" << endl;
        cout << "  - Supabase Studio: http://localhost:8080" << endl;
        cout << "  - Supabase Auth: http://localhost:9999" << endl;
        exit(0);
    } else {
        cerr << "\n❌ Failed to start containers. Exit code: " << result << endl;
        exit(result);
    }
}

// Main function
int main(int argc, char* argv[]) {
    // Save terminal state before making changes
    save_terminal();

    // Install signal handler for Ctrl-C
    signal(SIGINT, signal_handler);

    init_script_dir();

    // Handle command-line flags
    if (argc > 1) {
        string flag = argv[1];

        if (flag == "--check" || flag == "--verify") {
            run_verify_noninteractive();
            return 0;
        } else if (flag == "--setup") {
            run_setup_noninteractive();
            return 0;
        } else if (flag == "--build") {
            run_build_noninteractive();
            return 0;
        } else if (flag == "--test") {
            run_test_noninteractive();
            return 0;
        } else if (flag == "--start") {
            run_start_noninteractive();
            return 0;
        } else if (flag == "--help" || flag == "-h") {
            cout << "Usage: " << argv[0] << " [OPTION]" << endl;
            cout << "\nOptions:" << endl;
            cout << "  --setup       Run interactive setup" << endl;
            cout << "  --verify      Check environment configuration (non-interactive)" << endl;
            cout << "  --check       Alias for --verify" << endl;
            cout << "  --build       Build Docker images (non-interactive, shows output)" << endl;
            cout << "  --test        Test container health (non-interactive, shows output)" << endl;
            cout << "  --start       Start all containers (non-interactive, shows output)" << endl;
            cout << "  --help, -h    Show this help message" << endl;
            cout << "\nIf no option is provided, an interactive menu will be displayed." << endl;
            cout << "\nNote: Press Ctrl-C at any time to force exit." << endl;
            return 0;
        } else {
            cerr << "Unknown option: " << flag << endl;
            cerr << "Use --help for usage information." << endl;
            return 1;
        }
    }

    // No flags provided, run interactive menu
    run_main_menu();
    return 0;
}
