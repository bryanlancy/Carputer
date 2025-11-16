#include <atomic>
#include <chrono>
#include <csignal>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>
#include <sstream>

#include <pwd.h>
#include <unistd.h>

namespace fs = std::filesystem;

namespace {
constexpr auto kHubVersion = "0.1.0";
const std::chrono::seconds kHeartbeatInterval{5};

std::atomic_bool gRunning{true};
std::mutex gLogMutex;

void signalHandler(int)
{
    gRunning.store(false);
}

void installSignalHandlers()
{
    struct sigaction action;
    std::memset(&action, 0, sizeof(action));
    action.sa_handler = signalHandler;
    sigaction(SIGINT, &action, nullptr);
    sigaction(SIGTERM, &action, nullptr);
}

std::string resolveHome()
{
    if (const char* homeEnv = std::getenv("HOME"); homeEnv && *homeEnv) {
        return homeEnv;
    }

    if (passwd* pw = getpwuid(getuid()); pw) {
        return pw->pw_dir ? pw->pw_dir : std::string{"/tmp"};
    }

    return "/tmp";
}

std::string envOrDefault(const char* key, const std::string& fallback)
{
    if (const char* value = std::getenv(key); value && *value) {
        return value;
    }
    return fallback;
}

bool ensureDirectory(const fs::path& dir, fs::perms permissions)
{
    std::error_code ec;
    if (fs::exists(dir, ec)) {
        return fs::is_directory(dir, ec);
    }

    fs::create_directories(dir, ec);
    if (ec) {
        std::cerr << "carputer-hub: failed to create directory " << dir << ": " << ec.message() << '\n';
        return false;
    }

    fs::permissions(dir, permissions, ec);
    if (ec) {
        std::cerr << "carputer-hub: failed to set permissions on " << dir << ": " << ec.message() << '\n';
        return false;
    }

    return true;
}

void logLine(std::ofstream& log, const std::string& line)
{
    auto now = std::chrono::system_clock::now();
    std::time_t tt = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
    localtime_r(&tt, &tm);

    std::lock_guard<std::mutex> lock(gLogMutex);
    if (log.is_open()) {
        log << std::put_time(&tm, "%F %T") << ' ' << line << '\n';
        log.flush();
    }
    std::cout << line << '\n';
}

std::string readUptime()
{
    std::ifstream uptimeFile{"/proc/uptime"};
    double uptimeSeconds = 0.0;
    if (uptimeFile) {
        uptimeFile >> uptimeSeconds;
        int hours = static_cast<int>(uptimeSeconds) / 3600;
        int minutes = (static_cast<int>(uptimeSeconds) % 3600) / 60;
        int seconds = static_cast<int>(uptimeSeconds) % 60;
        std::ostringstream oss;
        oss << hours << "h " << minutes << "m " << seconds << "s";
        return oss.str();
    }
    return "unknown";
}

void showBanner()
{
    std::cout << "\n========================================\n"
              << "          CARPUTER HUB v" << kHubVersion << "\n"
              << "========================================\n\n";
}

void showMenu()
{
    std::cout << "Select an option:\n"
              << "  [1] System status\n"
              << "  [2] Connected devices (placeholder)\n"
              << "  [3] Launch applet (placeholder)\n"
              << "  [q] Quit session\n"
              << "> "
              << std::flush;
}

void handleSystemStatus(std::ofstream& log)
{
    std::ostringstream msg;
    msg << "System uptime: " << readUptime();
    logLine(log, msg.str());
}

void handleDevices(std::ofstream& log)
{
    logLine(log, "Connected devices:\n  - Touch display (I2C)\n  - USB HID controller\n  - Placeholder CAN bridge");
}

void handleLaunchApplet(std::ofstream& log)
{
    logLine(log, "Launching placeholder applet... (not implemented yet)");
}

void heartbeatWorker(std::ofstream& log)
{
    while (gRunning.load()) {
        logLine(log, "[heartbeat] hub alive");
        std::this_thread::sleep_for(kHeartbeatInterval);
    }
}

} // namespace

int main()
{
    installSignalHandlers();

    const fs::path home = resolveHome();
    const fs::path defaultDataDir = home / ".local" / "share" / "carputer";
    const fs::path dataDir = envOrDefault("CARPUTER_DATA_DIR", defaultDataDir.string());
    const fs::path logDir = dataDir / "logs";
    const fs::path ipcDir = envOrDefault("CARPUTER_IPC_DIR", (dataDir / "ipc").string());
    const fs::path logPath = envOrDefault("CARPUTER_LOG_FILE", (logDir / "carputer-hub.log").string());

    if (!ensureDirectory(dataDir, fs::perms::owner_all | fs::perms::group_read | fs::perms::group_exec)) {
        return EXIT_FAILURE;
    }
    if (!ensureDirectory(logDir, fs::perms::owner_all | fs::perms::group_read | fs::perms::group_exec)) {
        return EXIT_FAILURE;
    }
    if (!ensureDirectory(ipcDir, fs::perms::owner_all | fs::perms::group_read | fs::perms::group_exec)) {
        return EXIT_FAILURE;
    }

    std::ofstream log{logPath, std::ios::app};
    if (!log.is_open()) {
        std::cerr << "carputer-hub: unable to open log file at " << logPath << '\n';
    }

    logLine(log, "[carputer-hub] starting interactive session");
    logLine(log, std::string{"[carputer-hub] using data directory "} + dataDir.string());
    logLine(log, std::string{"[carputer-hub] ip communications directory "} + ipcDir.string());

    showBanner();

    std::thread heartbeat{heartbeatWorker, std::ref(log)};

    std::string selection;
    while (gRunning.load()) {
        showMenu();
        if (!std::getline(std::cin, selection)) {
            gRunning.store(false);
            break;
        }

        if (selection.empty()) {
            continue;
        }

        switch (selection[0]) {
        case '1':
            handleSystemStatus(log);
            break;
        case '2':
            handleDevices(log);
            break;
        case '3':
            handleLaunchApplet(log);
            break;
        case 'q':
        case 'Q':
            gRunning.store(false);
            break;
        default:
            logLine(log, "Unknown selection. Please choose a valid option.");
            break;
        }
    }

    if (heartbeat.joinable()) {
        heartbeat.join();
    }

    logLine(log, "[carputer-hub] shutting down");
    return EXIT_SUCCESS;
}
