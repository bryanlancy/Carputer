#!/bin/bash

# Generate Supabase keys for self-hosted setup
# In self-hosted Supabase, the service role key is derived from the JWT secret

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

BACKEND_ENV_FILE="backend/.env"
FRONTEND_ENV_FILE="frontend/.env"

echo "🔑 Generating Supabase Keys"
echo "============================"
echo ""

# Generate JWT secret if not exists
if [ ! -f "$BACKEND_ENV_FILE" ] || ! grep -q "JWT_SECRET=" "$BACKEND_ENV_FILE" || grep -q "JWT_SECRET=$" "$BACKEND_ENV_FILE"; then
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '\n')
    echo "✅ Generated JWT_SECRET"
else
    JWT_SECRET=$(grep "JWT_SECRET=" "$BACKEND_ENV_FILE" | cut -d '=' -f2-)
    echo "✓ Using existing JWT_SECRET from backend/.env"
fi

# In self-hosted Supabase, the service role key is the same as the JWT secret
# (or you can use the JWT secret directly for signing tokens)
SUPABASE_SERVICE_ROLE_KEY="$JWT_SECRET"

# Anon key for frontend (can be same or different, but for simplicity we'll use a derived version)
# In practice, anon key is often the same in self-hosted setups
SUPABASE_ANON_KEY="$JWT_SECRET"

echo ""
echo "📝 Updating backend/.env..."
if [ -f "$BACKEND_ENV_FILE" ]; then
    # Update JWT_SECRET if it was empty
    if grep -q "JWT_SECRET=$" "$BACKEND_ENV_FILE"; then
        sed_inplace "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$BACKEND_ENV_FILE"
    fi

    # Update SUPABASE_SERVICE_ROLE_KEY
    if grep -q "SUPABASE_SERVICE_ROLE_KEY=" "$BACKEND_ENV_FILE"; then
        sed_inplace "s|SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY|" "$BACKEND_ENV_FILE"
    else
        echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> "$BACKEND_ENV_FILE"
    fi
else
    echo "⚠️  backend/.env not found. Run ./setup.sh first."
fi

echo ""
echo "📝 Updating frontend/.env..."
if [ -f "$FRONTEND_ENV_FILE" ]; then
    # Update NEXT_PUBLIC_SUPABASE_ANON_KEY
    if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$FRONTEND_ENV_FILE"; then
        sed_inplace "s|NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY|" "$FRONTEND_ENV_FILE"
    else
        echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> "$FRONTEND_ENV_FILE"
    fi
else
    echo "⚠️  frontend/.env not found. Run ./setup.sh first."
fi

echo ""
echo "✅ Keys generated and updated!"
echo ""
echo "For self-hosted Supabase:"
echo "  - JWT_SECRET: Used to sign tokens (shared across services)"
echo "  - SUPABASE_SERVICE_ROLE_KEY: Same as JWT_SECRET (full admin access)"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY: Same as JWT_SECRET (client access)"
echo ""
echo "These keys are now set in your .env files."
echo "Make sure docker compose uses the same JWT_SECRET for auth and realtime services."

