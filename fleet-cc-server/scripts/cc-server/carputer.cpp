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
#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

using namespace ftxui;
using namespace std;

// Global variables
string SCRIPT_DIR;
string ROOT_ENV_FILE;

// Initialize script directory
void init_script_dir() {
    char cwd[4096];
    if (getcwd(cwd, sizeof(cwd)) != nullptr) {
        SCRIPT_DIR = string(cwd);
        // If we're in scripts/carputer, go up two levels to fleet-cc-server
        if (SCRIPT_DIR.find("/scripts/carputer") != string::npos) {
            size_t pos = SCRIPT_DIR.find("/scripts/carputer");
            SCRIPT_DIR = SCRIPT_DIR.substr(0, pos);
        } else if (SCRIPT_DIR.find("/scripts") != string::npos &&
                   SCRIPT_DIR.find("/carputer") == string::npos) {
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
string default_postgres_password() { return generate_secret(32); }
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
            submitted = true;
            result = existing_value.empty() ? default_value : existing_value;
            screen.ExitLoopClosure()();
            return true;
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
        if (wait && (e == Event::Return || e == Event::Character(' '))) {
            screen.ExitLoopClosure()();
            return true;
        }
        return false;
    });

    screen.Loop(component);
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

    show_message_screen("Fleet Command & Control Server Setup", {
        "Interactive Environment Configuration",
        "",
        "This will configure all required environment variables.",
        "Press Enter to keep existing values or accept defaults."
    });

    vector<pair<string, pair<string, pair<string, bool>>>> setup_vars = {
        {"Database Configuration", {"POSTGRES_DB", {"default_postgres_db", false}}},
        {"", {"POSTGRES_USER", {"default_postgres_user", false}}},
        {"", {"POSTGRES_PASSWORD", {"default_postgres_password", true}}},
        {"Security & Secrets", {"JWT_SECRET", {"default_jwt_secret", true}}},
        {"", {"SESSION_SECRET", {"default_session_secret", true}}},
        {"", {"DEVICE_REGISTRATION_TOKEN", {"default_device_token", true}}},
        {"", {"DB_ENC_KEY", {"default_db_enc_key", true}}},
        {"Supabase Configuration", {"SUPABASE_URL", {"default_supabase_url", false}}},
        {"", {"API_EXTERNAL_URL", {"default_api_external_url", false}}},
        {"", {"NEXT_PUBLIC_SUPABASE_URL", {"default_next_public_supabase_url", false}}},
        {"API Configuration", {"API_PORT", {"default_api_port", false}}},
        {"", {"NEXT_PUBLIC_API_URL", {"default_next_public_api_url", false}}},
        {"", {"NODE_ENV", {"default_node_env", false}}},
        {"Optional Configuration", {"SECURE_CHANNELS", {"default_secure_channels", false}}},
        {"", {"RSYNC_TARGET_PATH", {"default_rsync_target_path", false}}},
        {"", {"HQ_WIFI_SSID", {"default_hq_wifi_ssid", false}}}
    };

    map<string, string> descriptions = {
        {"POSTGRES_DB", "PostgreSQL database name"},
        {"POSTGRES_USER", "PostgreSQL username"},
        {"POSTGRES_PASSWORD", "PostgreSQL password (will be generated if blank)"},
        {"JWT_SECRET", "Secret key for JWT token signing (must be at least 32 characters)"},
        {"SESSION_SECRET", "Session secret for user sessions"},
        {"DEVICE_REGISTRATION_TOKEN", "Token for device registration"},
        {"DB_ENC_KEY", "Database encryption key for Realtime"},
        {"SUPABASE_URL", "Supabase URL (typically http://localhost:8000 for local)"},
        {"API_EXTERNAL_URL", "External API URL for GoTrue (typically http://localhost:9999)"},
        {"NEXT_PUBLIC_SUPABASE_URL", "Public Supabase URL for frontend (typically http://localhost:9999)"},
        {"API_PORT", "API server port (default: 3001)"},
        {"NEXT_PUBLIC_API_URL", "Public API URL (typically http://localhost:3001)"},
        {"NODE_ENV", "Node environment (development/production)"},
        {"SECURE_CHANNELS", "Enable secure channels for Realtime (true/false, default: true)"},
        {"RSYNC_TARGET_PATH", "Path for rsync data storage"},
        {"HQ_WIFI_SSID", "Headquarters WiFi SSID"}
    };

    string current_section = "";
    for (const auto& item : setup_vars) {
        if (!item.first.empty() && item.first != current_section) {
            current_section = item.first;
            // Don't show section message - just proceed to prompt
        }

        string desc = descriptions.count(item.second.first) ? descriptions[item.second.first] : item.second.first;
        prompt_env_var_interactive(item.second.first, desc, item.second.second.first, item.second.second.second);
    }

    // Handle JWT_SECRET synchronization
    string jwt_secret = read_env_value(ROOT_ENV_FILE, "JWT_SECRET");
    if (!jwt_secret.empty()) {
        write_env_value(ROOT_ENV_FILE, "SUPABASE_SERVICE_ROLE_KEY", jwt_secret);
        write_env_value(ROOT_ENV_FILE, "NEXT_PUBLIC_SUPABASE_ANON_KEY", jwt_secret);
    }

    // Ask about npm install
    auto screen = ScreenInteractive::Fullscreen();
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
        if (e == Event::Return) {
            if (npm_selected == 0) {
                string cmd = "cd " + SCRIPT_DIR + "/backend && npm install";
                system(cmd.c_str());
                cmd = "cd " + SCRIPT_DIR + "/frontend && npm install";
                system(cmd.c_str());
            }
            screen.ExitLoopClosure()();
            return true;
        }
        return false;
    });

    screen.Loop(npm_component);

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

    // Show initial message and wait
    show_message_screen("Building Docker Images", {
        "Building all Docker images...",
        "",
        "This may take several minutes. Output will be shown below."
    });

    // Exit FTXUI temporarily to run docker command with visible output
    cout << "\n=== Docker Build Output ===" << endl;
    cout.flush();

    string cmd = "cd " + SCRIPT_DIR + " && docker compose build 2>&1";
    int result = system(cmd.c_str());

    cout << "\n=== Build Complete ===" << endl;
    cout.flush();

    vector<string> messages;
    if (result == 0) {
        messages.push_back("✅ All Docker images built successfully!");
    } else {
        messages.push_back("❌ Build failed. Check the output above for errors.");
    }
    show_message_screen("Build Complete", messages);
}

// Test function
void run_test() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed."});
        return;
    }

    // Show initial message and wait
    show_message_screen("Testing Container Health", {"Checking container status..."});

    // Exit FTXUI temporarily to run docker commands
    cout << "\n=== Checking Container Status ===" << endl;
    cout.flush();

    string cmd = "cd " + SCRIPT_DIR + " && docker compose ps --services --filter status=running";
    FILE* pipe = popen(cmd.c_str(), "r");
    string running_output = "";
    char buffer[128];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        running_output += buffer;
    }
    pclose(pipe);

    vector<string> services = {"postgres", "api", "frontend", "auth", "realtime", "meta", "studio"};
    vector<string> messages;
    bool all_healthy = true;

    for (const auto& service : services) {
        cmd = "cd " + SCRIPT_DIR + " && docker compose ps " + service + " --format json";
        FILE* status_pipe = popen(cmd.c_str(), "r");
        string status_json = "";
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

    messages.insert(messages.begin(), "Container Status:");
    messages.insert(messages.begin() + 1, "");

    if (all_healthy) {
        messages.push_back("");
        messages.push_back("✅ All containers are healthy!");
    } else {
        messages.push_back("");
        messages.push_back("❌ Some containers are not healthy.");
    }

    cout << "\n=== Test Complete ===" << endl;
    cout.flush();

    show_message_screen("Container Health Check", messages);
}

// Start function
void run_start() {
    if (system("command -v docker >/dev/null 2>&1") != 0) {
        show_message_screen("Error", {"❌ Docker is not installed."});
        return;
    }

    // Show initial message and wait
    show_message_screen("Starting Containers", {
        "Starting all containers...",
        "",
        "Output will be shown below."
    });

    // Exit FTXUI temporarily to run docker command with visible output
    cout << "\n=== Docker Start Output ===" << endl;
    cout.flush();

    string cmd = "cd " + SCRIPT_DIR + " && docker compose up -d 2>&1";
    int result = system(cmd.c_str());

    cout << "\n=== Start Complete ===" << endl;
    cout.flush();

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

// Main function
int main(int argc, char* argv[]) {
    // Handle --check flag
    if (argc > 1 && string(argv[1]) == "--check") {
        init_script_dir();
        auto missing = check_required_variables();
        if (missing.empty()) {
            cout << "✅ All required environment variables are set!" << endl;
            return 0;
        } else {
            cout << "❌ Found " << missing.size() << " missing required environment variable(s)" << endl;
            for (const auto& var : missing) {
                cout << "  ✗ " << var.name << endl;
                cout << "     Required in: " << var.file_path << endl;
                cout << "     Description: " << var.description << endl;
            }
            return 1;
        }
    }

    init_script_dir();
    run_main_menu();

    return 0;
}
