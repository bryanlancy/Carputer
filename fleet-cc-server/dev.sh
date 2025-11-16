#!/bin/zsh

# Development helper script for Fleet CC Server
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
    docker-compose up -d
    echo -e "${GREEN}✅ Services started${NC}"
    echo ""
    echo "Dashboard: http://localhost:3000"
    echo "API: http://localhost:3001"
    echo "Studio: http://localhost:8080"
}

function stop_services() {
    check_docker
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Services stopped${NC}"
}

function show_logs() {
    check_docker
    docker-compose logs -f
}

function run_migrate() {
    check_docker
    echo -e "${GREEN}📊 Running database migrations...${NC}"
    docker-compose exec -T api npm run db:migrate
    echo -e "${GREEN}✅ Migrations complete${NC}"
}

function dev_backend() {
    echo -e "${GREEN}🔧 Starting backend in development mode...${NC}"

    # Check if port 3001 is already in use
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${YELLOW}⚠️  Port 3001 is already in use${NC}"
        read -q "?Kill the process? (y/N) " || REPLY=n
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            lsof -ti:3001 | xargs kill -9 2>/dev/null || true
            sleep 1
            echo -e "${GREEN}✓ Process killed${NC}"
        else
            echo "Cancelled. Please stop the process on port 3001 first."
            exit 1
        fi
    fi

    # Check if database is running
    if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  PostgreSQL is not running${NC}"
        echo -e "${YELLOW}   Start it with: docker-compose up -d postgres${NC}"
        echo -e "${YELLOW}   Or run: ./dev.sh start${NC}"
        echo ""
        read -q "?Continue anyway? (y/N) " || REPLY=n
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
    read "?Are you sure? This will remove all data. (y/N) " -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker-compose down -v
        docker-compose rm -f
        echo -e "${GREEN}✅ Cleanup complete${NC}"
    else
        echo "Cancelled"
    fi
}

function show_status() {
    check_docker
    echo -e "${GREEN}📊 Service Status:${NC}"
    docker-compose ps
}

# Main command handler
case "${1:-}" in
    setup)
        ./setup.sh
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

