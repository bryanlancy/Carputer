#!/bin/bash

# Fleet Command & Control Server Setup Script
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

# OS-specific sed in-place function
# macOS requires an extension (even if empty), Linux doesn't
sed_inplace() {
    if [ "$OS" = "macos" ]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

echo "🚀 Fleet Command & Control Server Setup"
echo "========================================"

# Create backend .env file
echo ""
echo "📝 Setting up backend environment..."
cd backend
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created backend/.env from .env.example"

        # Generate secrets if they're empty
        if ! grep -q "JWT_SECRET=" .env || grep -q "JWT_SECRET=$" .env; then
            JWT_SECRET=$(openssl rand -hex 32)
            sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env
        fi

        if ! grep -q "SESSION_SECRET=" .env || grep -q "SESSION_SECRET=$" .env; then
            SESSION_SECRET=$(openssl rand -hex 32)
            sed_inplace "s|SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" .env
        fi

        if ! grep -q "DEVICE_REGISTRATION_TOKEN=" .env || grep -q "DEVICE_REGISTRATION_TOKEN=$" .env; then
            DEVICE_TOKEN=$(openssl rand -hex 32)
            sed_inplace "s|DEVICE_REGISTRATION_TOKEN=.*|DEVICE_REGISTRATION_TOKEN=$DEVICE_TOKEN|" .env
        fi

        echo "✅ Generated secrets for backend"
    else
        echo "⚠️  backend/.env.example not found, skipping backend .env creation"
    fi
else
    echo "✓ backend/.env already exists"
fi
cd ..

# Create frontend .env file
echo ""
echo "📝 Setting up frontend environment..."
cd frontend
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ Created frontend/.env from .env.example"
    else
        echo "⚠️  frontend/.env.example not found, skipping frontend .env creation"
    fi
else
    echo "✓ frontend/.env already exists"
fi
cd ..

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
if [ ! -d node_modules ]; then
    npm install
else
    echo "✓ Backend dependencies already installed"
fi
cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
if [ ! -d node_modules ]; then
    npm install
else
    echo "✓ Frontend dependencies already installed"
fi
cd ..

# Build Docker images
echo ""
echo "🐳 Building Docker images..."
docker compose build

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Review and update backend/.env and frontend/.env files if needed"
echo "  2. Start services: make up  or  docker compose up -d"
echo "  3. Run migrations: make migrate  or  docker compose exec api npm run db:migrate"
echo "  4. Access dashboard: http://localhost:3000"
echo "  5. Access API: http://localhost:3001"
echo ""
echo "Note: Make sure to set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "      in the respective .env files if you plan to use Supabase features."
echo ""

