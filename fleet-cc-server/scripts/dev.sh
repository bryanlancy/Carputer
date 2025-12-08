#!/bin/bash

# Development helper script for Fleet CC Server
set -e

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            echo "linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

OS=$(detect_os)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if port is in use (cross-platform)
check_port() {
    local port=$1
    case "$OS" in
        macos|linux)
            if command -v lsof &> /dev/null; then
                lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1
            elif command -v netstat &> /dev/null; then
                netstat -an | grep -q ":$port.*LISTEN"
            else
                return 1
            fi
            ;;
        windows)
            if command -v netstat &> /dev/null; then
                netstat -an | grep -q ":$port.*LISTEN"
            else
                return 1
            fi
            ;;
        *)
            return 1
            ;;
    esac
}

# Kill process on port (cross-platform)
kill_port() {
    local port=$1
    case "$OS" in
        macos|linux)
            if command -v lsof &> /dev/null; then
                lsof -ti:$port | xargs kill -9 2>/dev/null || true
            elif command -v fuser &> /dev/null; then
                fuser -k $port/tcp 2>/dev/null || true
            fi
            ;;
        windows)
            if command -v netstat &> /dev/null; then
                # Windows: find PID and kill
                for pid in $(netstat -ano | grep ":$port" | grep LISTENING | awk '{print $5}'); do
                    taskkill //F //PID $pid 2>/dev/null || true
                done
            fi
            ;;
    esac
}

# Check if PostgreSQL is ready
check_postgres() {
    if command -v pg_isready &> /dev/null; then
        pg_isready -h localhost -p 5432 >/dev/null 2>&1
    else
        # Fallback: try to connect via psql or docker
        if command -v docker &> /dev/null; then
            docker ps | grep -q postgres || docker compose ps | grep -q postgres
        else
            return 1
        fi
    fi
}

function print_usage() {
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - Run initial setup (install deps, build images)"
    echo "  start     - Start all services in background"
    echo "  stop      - Stop all services"
    echo "  restart   - Restart all services"
    echo "  logs      - Show logs from all services"
    echo "  migrate   - Run database migrations"
    echo "  backend   - Start backend in dev mode (outside Docker)"
    echo "  frontend  - Start frontend in dev mode (outside Docker)"
    echo "  clean     - Remove all containers and volumes"
    echo "  status    - Show service status"
}

function check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
}

function start_services() {
    check_docker
    echo -e "${GREEN}🚀 Starting all services...${NC}"
    docker compose up -d
    echo -e "${GREEN}✅ Services started${NC}"
    echo ""
    echo "Dashboard: http://localhost:3000"
    echo "API: http://localhost:3001"
    echo "Studio: http://localhost:8080"
}

function stop_services() {
    check_docker
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    docker compose down
    echo -e "${GREEN}✅ Services stopped${NC}"
}

function show_logs() {
    check_docker
    docker compose logs -f
}

function run_migrate() {
    check_docker
    echo -e "${GREEN}📊 Running database migrations...${NC}"
    docker compose exec -T api npm run db:migrate
    echo -e "${GREEN}✅ Migrations complete${NC}"
}

function dev_backend() {
    echo -e "${GREEN}🔧 Starting backend in development mode...${NC}"

    # Check if port 3001 is already in use
    if check_port 3001; then
        echo -e "${YELLOW}⚠️  Port 3001 is already in use${NC}"
        read -p "Kill the process? (y/N) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill_port 3001
            sleep 1
            echo -e "${GREEN}✓ Process killed${NC}"
        else
            echo "Cancelled. Please stop the process on port 3001 first."
            exit 1
        fi
    fi

    # Check if database is running
    if ! check_postgres; then
        echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
        echo -e "${YELLOW}   Start it with: docker compose up -d postgres${NC}"
        echo -e "${YELLOW}   Or run: ./dev.sh start${NC}"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled."
            exit 1
        fi
    fi

    cd backend
    npm install

    # Force polling mode via environment variable for nodemon
    export CHOKIDAR_USEPOLLING=true
    export CHOKIDAR_INTERVAL=1000

    npm run dev
}

function dev_frontend() {
    echo -e "${GREEN}🎨 Starting frontend in development mode...${NC}"

    # Force webpack to use polling mode via environment variable
    # This prevents inotify file watcher limit issues
    export WATCHPACK_POLLING=true

    cd frontend
    npm install
    npm run dev
}

function clean_all() {
    check_docker
    echo -e "${YELLOW}🧹 Cleaning up containers and volumes...${NC}"
    read -p "Are you sure? This will remove all data. (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose down -v
        docker compose rm -f
        echo -e "${GREEN}✅ Cleanup complete${NC}"
    else
        echo "Cancelled"
    fi
}

function show_status() {
    check_docker
    echo -e "${GREEN}📊 Service Status:${NC}"
    docker compose ps
}

# Main command handler
case "${1:-}" in
    setup)
        # Get the directory where this script is located
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        SETUP="$SCRIPT_DIR/setup"
        
        # Check if setup executable exists, if not try to build it
        if [ ! -f "$SETUP" ]; then
            echo -e "${YELLOW}⚠️  setup executable not found. Attempting to build...${NC}"
            if [ -f "$SCRIPT_DIR/cc-server/Makefile.carputer" ]; then
                cd "$SCRIPT_DIR/cc-server"
                make -f Makefile.carputer
                cd - > /dev/null
            elif [ -f "$SCRIPT_DIR/cc-server/CMakeLists.txt" ]; then
                cd "$SCRIPT_DIR/cc-server"
                mkdir -p build
                cd build
                cmake ..
                make
                cd - > /dev/null
            else
                echo -e "${RED}❌ Could not find build files for setup${NC}"
                echo -e "${YELLOW}   Please build setup first. See scripts/cc-server/BUILD.md${NC}"
                exit 1
            fi
        fi
        
        # Run setup
        "$SETUP"
        ;;
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        ;;
    logs)
        show_logs
        ;;
    migrate)
        run_migrate
        ;;
    backend)
        dev_backend
        ;;
    frontend)
        dev_frontend
        ;;
    clean)
        clean_all
        ;;
    status)
        show_status
        ;;
    *)
        print_usage
        exit 1
        ;;
esac

