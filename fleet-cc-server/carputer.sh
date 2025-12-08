#!/bin/bash

# Carputer - Fleet CC Server Management Script
# Unified application management interface

set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
sed_inplace() {
    if [ "$OS" = "macos" ]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# File paths
ROOT_ENV_FILE="$SCRIPT_DIR/.env"

# Parse command line arguments
CHECK_MODE=false
for arg in "$@"; do
    case "$arg" in
        --check)
            CHECK_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--check]"
            echo ""
            echo "Options:"
            echo "  --check    Run verification check (non-interactive)"
            echo "  --help,-h  Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Helper function to read value from .env file
read_env_value() {
    local file="$1"
    local key="$2"
    if [ -f "$file" ]; then
        grep -E "^${key}=" "$file" 2>/dev/null | cut -d '=' -f2- | sed 's/^["'\'']\(.*\)["'\'']$/\1/' | tr -d '\n' || echo ""
    else
        echo ""
    fi
}

# Helper function to write value to .env file
write_env_value() {
    local file="$1"
    local key="$2"
    local value="$3"
    
    # Ensure file exists
    if [ ! -f "$file" ]; then
        touch "$file"
    fi
    
    # Escape special characters in value for sed
    # First escape backslashes, then other special chars
    local escaped_value=$(printf '%s\n' "$value" | sed 's/\\/\\\\/g' | sed 's/[[\.*^$()+?{|]/\\&/g' | tr -d '\n')
    
    if grep -qE "^${key}=" "$file"; then
        # Update existing value
        sed_inplace "s|^${key}=.*|${key}=${escaped_value}|" "$file"
    else
        # Add new value
        echo "${key}=${escaped_value}" >> "$file"
    fi
}

# Generate random secret
generate_secret() {
    local length="${1:-32}"
    openssl rand -base64 "$length" | tr -d '\n' | tr -d '\r'
}

# Generate hex secret
generate_hex_secret() {
    local length="${1:-32}"
    openssl rand -hex "$length" | tr -d '\n' | tr -d '\r'
}

# Helper function to center text in box (63 characters wide, accounting for ANSI codes)
center_in_box() {
    local text="$1"
    local box_width=63
    # Strip ANSI codes to get visible length
    local visible_text=$(echo "$text" | sed 's/\x1b\[[0-9;]*m//g')
    local visible_length=${#visible_text}
    local padding=$(( (box_width - visible_length) / 2 ))
    printf "%*s%s" $padding "" "$text"
}

# Display menu with arrow key navigation
show_menu() {
    local selected=$1
    clear
    echo ""
    echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║${NC}                                                               ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║$(center_in_box "${BOLD}${GREEN}Carputer${NC}")${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║$(center_in_box "${BOLD}Fleet CC Server${NC}")${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}║${NC}                                                               ${BOLD}${CYAN}║${NC}"
    echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Use arrow keys to navigate, Space/Enter to select:${NC}"
    echo ""
    
    # Menu options array
    local options=(
        "Setup        - Configure environment variables"
        "Verify       - Check environment configuration"
        "Build        - Build Docker images"
        "Test         - Test container health and startup"
        "Start        - Start all containers"
        "Exit         - Exit the menu"
    )
    
    # Display menu options with cursor
    for i in "${!options[@]}"; do
        if [ $i -eq $selected ]; then
            echo -e "  ${GREEN}▶${NC} ${CYAN}${options[$i]}${NC}"
        else
            echo -e "    ${options[$i]}"
        fi
    done
    
    echo ""
}

# Read arrow key input
read_arrow_key() {
    # Save current terminal settings
    local old_stty=$(stty -g 2>/dev/null || echo "")
    
    # Set terminal to raw mode (no echo, no canonical mode, wait indefinitely for input)
    stty raw -echo -icanon min 1 time 0 2>/dev/null
    
    # Read first character (this will block until a key is pressed)
    local first_char
    first_char=$(dd bs=1 count=1 2>/dev/null)
    local key="$first_char"
    
    # If it's an escape sequence, read more
    if [ "$first_char" = $'\033' ]; then
        # Read next 2 characters for arrow key sequences (with timeout)
        stty raw -echo -icanon min 0 time 1 2>/dev/null
        local seq=$(dd bs=1 count=2 2>/dev/null)
        stty raw -echo -icanon min 1 time 0 2>/dev/null
        key="$first_char$seq"
    fi
    
    # Restore terminal settings
    if [ -n "$old_stty" ]; then
        stty $old_stty 2>/dev/null
    else
        stty sane 2>/dev/null
    fi
    
    # Check for arrow keys and special keys
    case "$key" in
        $'\033[A'|$'\033OA')
            echo "UP"
            ;;
        $'\033[B'|$'\033OB')
            echo "DOWN"
            ;;
        $'\033[C'|$'\033OC')
            echo "RIGHT"
            ;;
        $'\033[D'|$'\033OD')
            echo "LEFT"
            ;;
        $'\n'|$'\r')
            echo "ENTER"
            ;;
        $' ')
            echo "SPACE"
            ;;
        $'q'|$'Q')
            echo "QUIT"
            ;;
        *)
            # Unknown key - ignore and wait for another
            echo "UNKNOWN"
            ;;
    esac
}

# Global array to store missing variables (used by verify function)
MISSING_VARS_ARRAY=()

# Check required environment variables
check_required_variables() {
    local missing_count=0
    MISSING_VARS_ARRAY=()
    
    # Define required variables with their file locations
    # Format: "VAR_NAME|PRIMARY_FILE|DESCRIPTION"
    declare -a required_vars=(
        "POSTGRES_DB|$ROOT_ENV_FILE|PostgreSQL database name"
        "POSTGRES_USER|$ROOT_ENV_FILE|PostgreSQL username"
        "POSTGRES_PASSWORD|$ROOT_ENV_FILE|PostgreSQL password"
        "JWT_SECRET|$ROOT_ENV_FILE|JWT secret for token signing"
        "SESSION_SECRET|$ROOT_ENV_FILE|Session secret"
        "DEVICE_REGISTRATION_TOKEN|$ROOT_ENV_FILE|Device registration token"
        "DB_ENC_KEY|$ROOT_ENV_FILE|Database encryption key for Realtime"
        "SUPABASE_URL|$ROOT_ENV_FILE|Supabase URL"
        "API_EXTERNAL_URL|$ROOT_ENV_FILE|External API URL for GoTrue"
        "NEXT_PUBLIC_API_URL|$ROOT_ENV_FILE|Public API URL"
        "NEXT_PUBLIC_SUPABASE_URL|$ROOT_ENV_FILE|Public Supabase URL"
        "SUPABASE_SERVICE_ROLE_KEY|$ROOT_ENV_FILE|Supabase service role key"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY|$ROOT_ENV_FILE|Supabase anonymous key"
        "API_PORT|$ROOT_ENV_FILE|API server port"
        "NODE_ENV|$ROOT_ENV_FILE|Node environment"
    )
    
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}🔍 Checking Required Environment Variables${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    for var_spec in "${required_vars[@]}"; do
        IFS='|' read -r var_name primary_file description <<< "$var_spec"
        
        # Check primary file (required for docker-compose)
        local primary_value=$(read_env_value "$primary_file" "$var_name")
        
        if [ -z "$primary_value" ]; then
            # Report as missing from primary location
            missing_count=$((missing_count + 1))
            MISSING_VARS_ARRAY+=("$var_name|$primary_file|$description")
        fi
    done
    
    if [ $missing_count -eq 0 ]; then
        echo -e "${GREEN}✅ All required environment variables are set!${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ Found $missing_count missing required environment variable(s):${NC}"
        echo ""
        echo -e "${YELLOW}Missing Variables:${NC}"
        echo ""
        
        for var_spec in "${MISSING_VARS_ARRAY[@]}"; do
            IFS='|' read -r var_name file_path description <<< "$var_spec"
            echo -e "  ${RED}✗${NC} ${CYAN}${var_name}${NC}"
            echo -e "     ${YELLOW}Required in:${NC} ${file_path}"
            echo -e "     ${YELLOW}Description:${NC} ${description}"
            echo ""
        done
        
        return 1
    fi
}

# Setup missing variables only
setup_missing_variables() {
    local missing_vars=("$@")
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        return 0
    fi
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}Configuring Missing Variables${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}Please provide values for the missing variables.${NC}"
    echo -e "${YELLOW}Press Enter to keep existing values or accept defaults.${NC}"
    echo ""
    
    # Map variable names to their generator functions and sensitivity
    declare -A var_generators=(
        ["POSTGRES_DB"]="default_postgres_db|false"
        ["POSTGRES_USER"]="default_postgres_user|false"
        ["POSTGRES_PASSWORD"]="default_postgres_password|true"
        ["JWT_SECRET"]="default_jwt_secret|true"
        ["SESSION_SECRET"]="default_session_secret|true"
        ["DEVICE_REGISTRATION_TOKEN"]="default_device_token|true"
        ["DB_ENC_KEY"]="default_db_enc_key|true"
        ["SUPABASE_URL"]="default_supabase_url|false"
        ["API_EXTERNAL_URL"]="default_api_external_url|false"
        ["NEXT_PUBLIC_API_URL"]="default_next_public_api_url|false"
        ["NEXT_PUBLIC_SUPABASE_URL"]="default_next_public_supabase_url|false"
        ["SUPABASE_SERVICE_ROLE_KEY"]="default_jwt_secret|true"
        ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]="default_jwt_secret|true"
        ["API_PORT"]="default_api_port|false"
        ["NODE_ENV"]="default_node_env|false"
    )
    
    for var_spec in "${missing_vars[@]}"; do
        IFS='|' read -r var_name file_path description <<< "$var_spec"
        
        local generator_info="${var_generators[$var_name]}"
        if [ -z "$generator_info" ]; then
            # No generator found, use prompt without default
            prompt_env_var "$var_name" "$description" "" "root" "false"
        else
            IFS='|' read -r generator_func sensitive <<< "$generator_info"
            prompt_env_var "$var_name" "$description" "$generator_func" "root" "$sensitive"
        fi
    done
    
    # Handle JWT_SECRET synchronization if it was set
    local jwt_secret=$(read_env_value "$ROOT_ENV_FILE" "JWT_SECRET")
    if [ -n "$jwt_secret" ]; then
        # Check if SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY are still missing
        local supabase_key=$(read_env_value "$ROOT_ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY")
        local anon_key=$(read_env_value "$ROOT_ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY")
        
        if [ -z "$supabase_key" ]; then
            write_env_value "$ROOT_ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY" "$jwt_secret"
        fi
        if [ -z "$anon_key" ]; then
            write_env_value "$ROOT_ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$jwt_secret"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✅ Missing variables configured!${NC}"
    echo ""
}

# Interactive prompt for environment variable
prompt_env_var() {
    local var_name="$1"
    local description="$2"
    local default_generator="$3"  # Function name to generate default, or "required" or empty string
    local file_target="$4"  # Which file(s) to write to: "root", "backend", "frontend", "all", or comma-separated list
    local sensitive="${5:-false}"  # Whether to hide input
    
    # All variables are stored in root .env file only
    local existing_value=$(read_env_value "$ROOT_ENV_FILE" "$var_name")
    
    # Determine default value
    local default_value=""
    local default_display=""
    
    if [ -n "$existing_value" ]; then
        default_value="$existing_value"
        if [ "$sensitive" = "true" ]; then
            default_display="[existing hidden value]"
        else
            default_display="[$existing_value]"
        fi
    elif [ "$default_generator" = "required" ]; then
        default_value=""
        default_display="[required]"
    elif [ -n "$default_generator" ]; then
        # Call the generator function
        default_value=$($default_generator)
        default_display="[$default_value]"
    else
        default_value=""
        default_display="[leave blank to skip]"
    fi
    
    # Display prompt
    echo ""
    if [ "$sensitive" = "true" ] && [ -n "$existing_value" ]; then
        echo -e "${CYAN}${var_name}${NC}"
        echo -e "  ${description}"
        echo -e "  Current: ${GREEN}[hidden]${NC}"
        echo -ne "  Enter new value (or press Enter to keep current): "
    else
        echo -e "${CYAN}${var_name}${NC}"
        echo -e "  ${description}"
        echo -ne "  Value ${default_display}: "
    fi
    
    # Read input
    if [ "$sensitive" = "true" ]; then
        read -s user_input
        echo ""  # New line after hidden input
    else
        read user_input
    fi
    
    # Determine final value
    local final_value=""
    
    if [ -z "$user_input" ]; then
        # User pressed Enter - determine what to do
        if [ -n "$existing_value" ]; then
            # Keep existing value
            final_value="$existing_value"
            echo -e "  ${GREEN}✓${NC} Keeping existing value"
        elif [ "$default_generator" = "required" ]; then
            # Required but user didn't provide - generate default
            final_value=$($default_generator)
            echo -e "  ${YELLOW}⚠${NC}  Required value not provided, generating default"
        elif [ -n "$default_generator" ]; then
            # Has generator - use generated default
            final_value="$default_value"
            echo -e "  ${GREEN}✓${NC} Using generated default: ${final_value}"
        else
            # Optional and no default - skip
            echo -e "  ${BLUE}⊘${NC} Skipping (optional)"
            return
        fi
    else
        # User provided value - use it
        final_value="$user_input"
        echo -e "  ${GREEN}✓${NC} Value set"
    fi
    
    # Write to root .env file
    write_env_value "$ROOT_ENV_FILE" "$var_name" "$final_value"
}

# Default generators
default_postgres_db() { echo "fleet_cc"; }
default_postgres_user() { echo "postgres"; }
default_postgres_password() { generate_secret 32; }
default_jwt_secret() { generate_secret 32; }
default_session_secret() { generate_secret 32; }
default_device_token() { generate_hex_secret 32; }
default_db_enc_key() { generate_hex_secret 32; }
default_supabase_url() { echo "http://localhost:8000"; }
default_api_external_url() { echo "http://localhost:9999"; }
default_next_public_api_url() { echo "http://localhost:3001"; }
default_next_public_supabase_url() { echo "http://localhost:9999"; }
default_api_port() { echo "3001"; }
default_node_env() { echo "development"; }
default_secure_channels() { echo "true"; }
default_rsync_target_path() { echo "/var/fleet-data"; }
default_hq_wifi_ssid() { echo "HQNetwork"; }

# Setup function
run_setup() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${GREEN}🚀 Fleet Command & Control Server Setup${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}Interactive Environment Configuration${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 1
    fi

    if ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
        echo ""
        read -p "Press Enter to continue..."
        return 1
    fi

    echo -e "${GREEN}✓${NC} Docker and Docker Compose detected"
    echo ""
    echo -e "${YELLOW}This script will configure all required environment variables.${NC}"
    echo -e "${YELLOW}Press Enter to keep existing values or accept defaults.${NC}"
    echo ""
    read -p "Press Enter to continue..."

    # Ensure root .env file exists (primary source for docker-compose)
    echo ""
    echo -e "${BLUE}📝 Preparing environment files...${NC}"
    if [ ! -f "$ROOT_ENV_FILE" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example "$ROOT_ENV_FILE"
            echo -e "  ${GREEN}✓${NC} Created root .env from .env.example"
        else
            touch "$ROOT_ENV_FILE"
            echo -e "  ${GREEN}✓${NC} Created root .env"
        fi
    else
        echo -e "  ${GREEN}✓${NC} Root .env already exists"
    fi
    echo -e "  ${YELLOW}Note:${NC} All docker-compose variables are configured in root .env file"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Database Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

    prompt_env_var "POSTGRES_DB" "PostgreSQL database name" "default_postgres_db" "root"
    prompt_env_var "POSTGRES_USER" "PostgreSQL username" "default_postgres_user" "root"
    prompt_env_var "POSTGRES_PASSWORD" "PostgreSQL password (will be generated if blank)" "default_postgres_password" "root" "true"

    # Note: DATABASE_URL is automatically constructed from POSTGRES_* variables
    # in docker-compose.yml, so it doesn't need to be set in .env

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Security & Secrets${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

    # Generate JWT secret first (needed for other keys)
    JWT_SECRET_EXISTING=$(read_env_value "$ROOT_ENV_FILE" "JWT_SECRET")

    if [ -z "$JWT_SECRET_EXISTING" ]; then
        JWT_SECRET_NEW=$(generate_secret 32)
        echo ""
        echo -e "${CYAN}JWT_SECRET${NC}"
        echo -e "  Secret key for JWT token signing (must be at least 32 characters)"
        echo -e "  Generated: ${GREEN}[hidden]${NC}"
        echo -ne "  Press Enter to use generated value, or type new value: "
        read -s user_input
        echo ""
        
        if [ -z "$user_input" ]; then
            JWT_SECRET="$JWT_SECRET_NEW"
            echo -e "  ${GREEN}✓${NC} Using generated JWT secret"
        else
            JWT_SECRET="$user_input"
            echo -e "  ${GREEN}✓${NC} Using custom JWT secret"
        fi
        
        write_env_value "$ROOT_ENV_FILE" "JWT_SECRET" "$JWT_SECRET"
    else
        echo ""
        echo -e "${CYAN}JWT_SECRET${NC}"
        echo -e "  Secret key for JWT token signing"
        echo -e "  Current: ${GREEN}[hidden]${NC}"
        echo -ne "  Press Enter to keep current, or type new value: "
        read -s user_input
        echo ""
        
        if [ -z "$user_input" ]; then
            JWT_SECRET="$JWT_SECRET_EXISTING"
            echo -e "  ${GREEN}✓${NC} Keeping existing JWT secret"
        else
            JWT_SECRET="$user_input"
            write_env_value "$ROOT_ENV_FILE" "JWT_SECRET" "$JWT_SECRET"
            echo -e "  ${GREEN}✓${NC} JWT secret updated"
        fi
    fi

    # Set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY to match JWT_SECRET
    write_env_value "$ROOT_ENV_FILE" "SUPABASE_SERVICE_ROLE_KEY" "$JWT_SECRET"
    write_env_value "$ROOT_ENV_FILE" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$JWT_SECRET"
    echo -e "  ${GREEN}✓${NC} SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_ANON_KEY synchronized with JWT_SECRET"

    prompt_env_var "SESSION_SECRET" "Session secret for user sessions" "default_session_secret" "root" "true"
    prompt_env_var "DEVICE_REGISTRATION_TOKEN" "Token for device registration" "default_device_token" "root" "true"
    prompt_env_var "DB_ENC_KEY" "Database encryption key for Realtime" "default_db_enc_key" "root" "true"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Supabase Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

    prompt_env_var "SUPABASE_URL" "Supabase URL (typically http://localhost:8000 for local)" "default_supabase_url" "root"
    prompt_env_var "API_EXTERNAL_URL" "External API URL for GoTrue (typically http://localhost:9999)" "default_api_external_url" "root"
    prompt_env_var "NEXT_PUBLIC_SUPABASE_URL" "Public Supabase URL for frontend (typically http://localhost:9999)" "default_next_public_supabase_url" "root"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  API Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

    prompt_env_var "API_PORT" "API server port (default: 3001)" "default_api_port" "root"
    prompt_env_var "NEXT_PUBLIC_API_URL" "Public API URL (typically http://localhost:3001)" "default_next_public_api_url" "root"
    prompt_env_var "NODE_ENV" "Node environment (development/production)" "default_node_env" "root"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Optional Configuration${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

    prompt_env_var "SECURE_CHANNELS" "Enable secure channels for Realtime (true/false, default: true)" "default_secure_channels" "root"
    prompt_env_var "RSYNC_TARGET_PATH" "Path for rsync data storage" "default_rsync_target_path" "root"
    prompt_env_var "HQ_WIFI_SSID" "Headquarters WiFi SSID" "default_hq_wifi_ssid" "root"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Environment configuration complete!${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    # Ask about installing dependencies
    echo -e "${YELLOW}Would you like to install npm dependencies now? (Y/n)${NC}"
    read -p "> " install_deps

    # Default to yes if empty
    if [[ -z "$install_deps" ]] || [[ "$install_deps" =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
        cd backend
        if [ ! -d node_modules ]; then
            npm install
            echo -e "${GREEN}✓${NC} Backend dependencies installed"
        else
            echo -e "${GREEN}✓${NC} Backend dependencies already installed"
        fi
        cd ..
        
        echo ""
        echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
        cd frontend
        if [ ! -d node_modules ]; then
            npm install
            echo -e "${GREEN}✓${NC} Frontend dependencies installed"
        else
            echo -e "${GREEN}✓${NC} Frontend dependencies already installed"
        fi
        cd ..
    fi

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║${NC}                    ${CYAN}Setup Complete!${NC}                        ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo ""
    echo -e "  1. ${YELLOW}Review environment configuration:${NC}"
    echo -e "     - ${ROOT_ENV_FILE} (primary source for docker-compose)"
    echo ""
    echo -e "  2. ${YELLOW}Build and start services:${NC}"
    echo -e "     Use options 3 (Build) and 5 (Start) from the main menu"
    echo ""
    read -p "Press Enter to return to menu..."
}

# Build function
run_build() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}Building Docker Images${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed.${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed.${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo -e "${YELLOW}Building all Docker images...${NC}"
    echo ""
    
    if docker compose build; then
        echo ""
        echo -e "${GREEN}✅ All Docker images built successfully!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Build failed. Check the output above for errors.${NC}"
    fi
    
    echo ""
    read -p "Press Enter to return to menu..."
}

# Test function
run_test() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}Testing Container Health${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed.${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo -e "${YELLOW}Checking container status...${NC}"
    echo ""
    
    # Check if containers are running
    local running_containers=$(docker compose ps --services --filter "status=running" 2>/dev/null || echo "")
    local total_containers=$(docker compose ps --services 2>/dev/null | wc -l | tr -d ' ')
    
    if [ -z "$running_containers" ] || [ "$total_containers" = "0" ]; then
        echo -e "${YELLOW}⚠${NC}  No containers are currently running."
        echo -e "${YELLOW}   Starting containers in test mode...${NC}"
        echo ""
        
        # Start containers
        if docker compose up -d; then
            echo ""
            echo -e "${GREEN}✓${NC} Containers started"
            echo ""
            echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
            sleep 5
        else
            echo -e "${RED}❌ Failed to start containers${NC}"
            read -p "Press Enter to continue..."
            return 1
        fi
    fi
    
    # Check health of each service
    echo -e "${YELLOW}Checking service health...${NC}"
    echo ""
    
    local services=("postgres" "api" "frontend" "auth" "realtime" "meta" "studio")
    local all_healthy=true
    
    for service in "${services[@]}"; do
        local status=$(docker compose ps "$service" --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "not found")
        
        if [ "$status" = "running" ]; then
            echo -e "  ${GREEN}✓${NC} ${CYAN}${service}${NC} - ${GREEN}running${NC}"
        else
            echo -e "  ${RED}✗${NC} ${CYAN}${service}${NC} - ${RED}${status}${NC}"
            all_healthy=false
        fi
    done
    
    echo ""
    
    # Show logs for any unhealthy services
    if [ "$all_healthy" = false ]; then
        echo -e "${YELLOW}Checking logs for issues...${NC}"
        echo ""
        docker compose ps --filter "status=exited" --format "{{.Service}}" | while read -r service; do
            if [ -n "$service" ]; then
                echo -e "${YELLOW}Logs for ${service}:${NC}"
                docker compose logs --tail=20 "$service" 2>&1 | head -30
                echo ""
            fi
        done
    fi
    
    # Show container status summary
    echo -e "${YELLOW}Container Status Summary:${NC}"
    docker compose ps
    echo ""
    
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}✅ All containers are healthy!${NC}"
    else
        echo -e "${RED}❌ Some containers are not healthy. Check logs above.${NC}"
    fi
    
    echo ""
    read -p "Press Enter to return to menu..."
}

# Start function
run_start() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║$(center_in_box "${CYAN}Starting Containers${NC}")${BLUE}║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed.${NC}"
        read -p "Press Enter to continue..."
        return 1
    fi
    
    echo -e "${YELLOW}Starting all containers...${NC}"
    echo ""
    
    if docker compose up -d; then
        echo ""
        echo -e "${GREEN}✅ All containers started successfully!${NC}"
        echo ""
        echo -e "${CYAN}Access services at:${NC}"
        echo -e "  - Frontend: ${GREEN}http://localhost:3000${NC}"
        echo -e "  - API: ${GREEN}http://localhost:3001${NC}"
        echo -e "  - Supabase Studio: ${GREEN}http://localhost:8080${NC}"
        echo -e "  - Supabase Auth: ${GREEN}http://localhost:9999${NC}"
        echo ""
        echo -e "${YELLOW}View logs:${NC} ${CYAN}docker compose logs -f${NC}"
        echo -e "${YELLOW}View status:${NC} ${CYAN}docker compose ps${NC}"
    else
        echo ""
        echo -e "${RED}❌ Failed to start containers. Check the output above for errors.${NC}"
    fi
    
    echo ""
    read -p "Press Enter to return to menu..."
}

# Verify function
run_verify() {
    check_required_variables
    local exit_code=$?
    
    if [ $exit_code -ne 0 ] && [ ${#MISSING_VARS_ARRAY[@]} -gt 0 ]; then
        # Missing variables found
        echo ""
        echo -e "${YELLOW}Would you like to fix these issues now? (y/n)${NC}"
        read -p "> " fix_choice
        
        if [[ "$fix_choice" =~ ^[Yy]$ ]]; then
            echo ""
            setup_missing_variables "${MISSING_VARS_ARRAY[@]}"
            echo ""
            echo -e "${YELLOW}Re-running verification...${NC}"
            echo ""
            check_required_variables
            local verify_exit=$?
            if [ $verify_exit -eq 0 ]; then
                echo -e "${GREEN}✅ All variables are now configured correctly!${NC}"
            fi
            exit_code=$verify_exit
        else
            echo ""
            echo -e "${YELLOW}To fix manually:${NC}"
            echo -e "  Run ${GREEN}./carputer.sh${NC} and select option 1 (Setup)"
        fi
    fi
    
    echo ""
    read -p "Press Enter to return to menu..."
    return $exit_code
}

# Main menu loop with arrow key navigation
main_menu() {
    local selected=0
    local num_options=6
    
    while true; do
        show_menu $selected
        
        # Read arrow key input
        local key=$(read_arrow_key)
        
        case $key in
            UP)
                selected=$((selected - 1))
                if [ $selected -lt 0 ]; then
                    selected=$((num_options - 1))
                fi
                # Refresh menu to show new selection
                ;;
            DOWN)
                selected=$((selected + 1))
                if [ $selected -ge $num_options ]; then
                    selected=0
                fi
                # Refresh menu to show new selection
                ;;
            ENTER|SPACE)
                clear
                case $selected in
                    0)
                        run_setup
                        ;;
                    1)
                        run_verify
                        ;;
                    2)
                        run_build
                        ;;
                    3)
                        run_test
                        ;;
                    4)
                        run_start
                        ;;
                    5)
                        echo ""
                        echo -e "${GREEN}Goodbye! 👋${NC}"
                        echo ""
                        exit 0
                        ;;
                esac
                # After action completes, menu will refresh automatically
                ;;
            QUIT)
                echo ""
                echo -e "${GREEN}Goodbye! 👋${NC}"
                echo ""
                exit 0
                ;;
            UNKNOWN|*)
                # Unknown key, ignore and keep menu displayed
                # Don't refresh menu for unknown keys
                ;;
        esac
    done
}

# Trap to restore terminal settings on exit
trap 'stty sane 2>/dev/null; exit' INT TERM EXIT

# If --check flag is set, run verification and exit
if [ "$CHECK_MODE" = true ]; then
    check_required_variables
    exit $?
fi

# Run main menu
main_menu

