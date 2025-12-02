#!/bin/bash

# Generate Supabase keys for self-hosted setup
# In self-hosted Supabase, the service role key is derived from the JWT secret

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the fleet-cc-server directory (parent of scripts)
FLEET_CC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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

BACKEND_ENV_FILE="$FLEET_CC_DIR/backend/.env"
FRONTEND_ENV_FILE="$FLEET_CC_DIR/frontend/.env"

echo "🔑 Generating Supabase Keys"
echo "============================"
echo ""

# Get or generate JWT secret
if [ -f "$BACKEND_ENV_FILE" ] && grep -q "JWT_SECRET=" "$BACKEND_ENV_FILE" && ! grep -q "JWT_SECRET=$" "$BACKEND_ENV_FILE"; then
    # Extract existing JWT_SECRET
    JWT_SECRET=$(grep "JWT_SECRET=" "$BACKEND_ENV_FILE" | cut -d '=' -f2- | tr -d '\n' | tr -d '"' | tr -d "'")
    if [ -z "$JWT_SECRET" ]; then
        # Empty value, generate new one
        JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
        echo "✅ Generated new JWT_SECRET (existing was empty)"
    else
        echo "✓ Using existing JWT_SECRET from backend/.env"
    fi
else
    # No JWT_SECRET found, generate new one
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    echo "✅ Generated new JWT_SECRET"
fi

# In self-hosted Supabase, the service role key is the same as the JWT secret
# (or you can use the JWT secret directly for signing tokens)
SUPABASE_SERVICE_ROLE_KEY="$JWT_SECRET"

# Anon key for frontend (can be same or different, but for simplicity we'll use a derived version)
# In practice, anon key is often the same in self-hosted setups
SUPABASE_ANON_KEY="$JWT_SECRET"

# Track success
BACKEND_UPDATED=false
FRONTEND_UPDATED=false

echo ""
echo "📝 Updating backend/.env..."
if [ -f "$BACKEND_ENV_FILE" ]; then
    # Update or add JWT_SECRET
    if grep -q "JWT_SECRET=" "$BACKEND_ENV_FILE"; then
        # Check if it's empty or needs updating
        EXISTING_JWT=$(grep "JWT_SECRET=" "$BACKEND_ENV_FILE" | cut -d '=' -f2- | tr -d '\n' | tr -d '"' | tr -d "'")
        if [ -z "$EXISTING_JWT" ] || grep -q "JWT_SECRET=$" "$BACKEND_ENV_FILE"; then
            sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$BACKEND_ENV_FILE"
            echo "  ✓ Updated JWT_SECRET"
            BACKEND_UPDATED=true
        fi
    else
        # Add JWT_SECRET if it doesn't exist
        echo "JWT_SECRET=$JWT_SECRET" >> "$BACKEND_ENV_FILE"
        echo "  ✓ Added JWT_SECRET"
        BACKEND_UPDATED=true
    fi

    # Update SUPABASE_SERVICE_ROLE_KEY
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" "$BACKEND_ENV_FILE"; then
        sed_inplace "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY|" "$BACKEND_ENV_FILE"
        echo "  ✓ Updated SUPABASE_SERVICE_ROLE_KEY"
        BACKEND_UPDATED=true
    else
        # Add the key if it doesn't exist
        echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> "$BACKEND_ENV_FILE"
        echo "  ✓ Added SUPABASE_SERVICE_ROLE_KEY"
        BACKEND_UPDATED=true
    fi
    
    # Also ensure SUPABASE_URL is set
    if ! grep -q "SUPABASE_URL=" "$BACKEND_ENV_FILE"; then
        echo "SUPABASE_URL=http://localhost:8000" >> "$BACKEND_ENV_FILE"
        echo "  ✓ Added SUPABASE_URL"
        BACKEND_UPDATED=true
    fi
    
    if [ "$BACKEND_UPDATED" = false ]; then
        echo "  ℹ️  No updates needed (keys already set)"
    fi
else
    echo "  ❌ backend/.env not found at: $BACKEND_ENV_FILE"
    echo "     Expected location: fleet-cc-server/backend/.env"
fi

echo ""
echo "📝 Updating frontend/.env..."
if [ -f "$FRONTEND_ENV_FILE" ]; then
    # Update NEXT_PUBLIC_SUPABASE_ANON_KEY
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$FRONTEND_ENV_FILE"; then
        sed_inplace "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" "$FRONTEND_ENV_FILE"
        echo "  ✓ Updated NEXT_PUBLIC_SUPABASE_ANON_KEY"
        FRONTEND_UPDATED=true
    else
        # Add the key if it doesn't exist
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> "$FRONTEND_ENV_FILE"
        echo "  ✓ Added NEXT_PUBLIC_SUPABASE_ANON_KEY"
        FRONTEND_UPDATED=true
    fi
    
    # Also ensure NEXT_PUBLIC_SUPABASE_URL is set (point to GoTrue on port 9999)
    if grep -q "NEXT_PUBLIC_SUPABASE_URL=" "$FRONTEND_ENV_FILE"; then
        # Update existing URL to point to GoTrue (port 9999)
        sed_inplace "s|NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999|" "$FRONTEND_ENV_FILE"
        echo "  ✓ Updated NEXT_PUBLIC_SUPABASE_URL to http://localhost:9999"
        FRONTEND_UPDATED=true
    else
        echo "NEXT_PUBLIC_SUPABASE_URL=http://localhost:9999" >> "$FRONTEND_ENV_FILE"
        echo "  ✓ Added NEXT_PUBLIC_SUPABASE_URL"
        FRONTEND_UPDATED=true
    fi
    
    if [ "$FRONTEND_UPDATED" = false ]; then
        echo "  ℹ️  No updates needed (keys already set)"
    fi
else
    echo "  ❌ frontend/.env not found at: $FRONTEND_ENV_FILE"
    echo "     Expected location: fleet-cc-server/frontend/.env"
fi

echo ""
# Only show success if at least one file was found and updated
if [ -f "$BACKEND_ENV_FILE" ] || [ -f "$FRONTEND_ENV_FILE" ]; then
    if [ "$BACKEND_UPDATED" = true ] || [ "$FRONTEND_UPDATED" = true ]; then
        echo "✅ Keys updated successfully!"
    else
        echo "ℹ️  Keys are already set in .env files."
    fi
else
    echo "❌ Failed to update keys - .env files not found."
    echo ""
    echo "Please ensure the .env files exist at:"
    echo "  - $BACKEND_ENV_FILE"
    echo "  - $FRONTEND_ENV_FILE"
    echo ""
    echo "You can create them by running: ./fleet-cc-server/setup.sh"
    exit 1
fi

echo ""
echo "For self-hosted Supabase:"
echo "  - JWT_SECRET: Used to sign tokens (shared across services)"
echo "  - SUPABASE_SERVICE_ROLE_KEY: Same as JWT_SECRET (full admin access)"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY: Same as JWT_SECRET (client access)"
echo ""
echo "Make sure docker compose uses the same JWT_SECRET for auth and realtime services."

