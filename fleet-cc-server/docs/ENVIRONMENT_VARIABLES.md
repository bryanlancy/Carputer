# Environment Variables Setup Guide

This guide explains all environment variables needed for the Fleet Command & Control server.

## Quick Setup

1. Copy the example files:
   ```bash
   cp fleet-cc-server/backend/.env.example fleet-cc-server/backend/.env
   cp fleet-cc-server/frontend/.env.example fleet-cc-server/frontend/.env
   ```

2. Generate Supabase keys (recommended):
   ```bash
   ./fleet-cc-server/scripts/generate-supabase-keys.sh
   ```

3. Or manually set the values as described below.

## Backend Environment Variables

Location: `fleet-cc-server/backend/.env`

### Database Configuration

```bash
# PostgreSQL connection string
DATABASE_URL=postgres://postgres:postgres@localhost:5432/fleet_cc

# Or individual components:
POSTGRES_DB=fleet_cc
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

**What to set:**
- For local development: Use defaults or match your local PostgreSQL setup
- For production: Use a secure password and connection string

### Supabase Configuration

```bash
# Supabase Auth URL (where GoTrue is running)
SUPABASE_URL=http://localhost:8000

# Supabase Auth External URL (required by GoTrue, defaults to http://localhost:9999)
API_EXTERNAL_URL=http://localhost:9999

# Service Role Key (same as JWT_SECRET for self-hosted)
SUPABASE_SERVICE_ROLE_KEY=your-jwt-secret-here

# JWT Secret (used for token signing, must be at least 32 characters)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
```

**What to set:**
- `SUPABASE_URL`:
  - Local: `http://localhost:8000` (default)
  - Production: Your Supabase Auth service URL
- `API_EXTERNAL_URL`:
  - Local: `http://localhost:9999` (default, GoTrue port)
  - Production: Your public Supabase Auth URL
  - **Required by GoTrue** - must be set for auth service to start
- `GOTRUE_DB_DATABASE_URL`:
  - **Important**: Must include `?search_path=auth` parameter
  - Example: `postgres://postgres:postgres@postgres:5432/fleet_cc?search_path=auth`
  - This ensures GoTrue can find tables in the `auth` schema
- `SUPABASE_SERVICE_ROLE_KEY`:
  - For self-hosted: Same value as `JWT_SECRET`
  - Generate with: `openssl rand -base64 32`
- `JWT_SECRET`:
  - Generate a secure random string: `openssl rand -base64 32`
  - Must be at least 32 characters
  - **IMPORTANT**: Keep this secret! Never commit to git.

### Server Configuration

```bash
# Server port
PORT=3001

# Server host (0.0.0.0 allows connections from other machines)
HOST=0.0.0.0

# CORS allowed origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,http://10.0.0.68:3000

# Node environment
NODE_ENV=development
```

**What to set:**
- `PORT`: Default `3001` is fine for most cases
- `HOST`: `0.0.0.0` allows connections from network, `127.0.0.1` is localhost only
- `CORS_ORIGIN`: Add your frontend URLs (comma-separated, no spaces after commas)

### Security

```bash
# Session secret (for sessions if you add them)
SESSION_SECRET=your-super-secret-session-token

# Device registration token (for manual device registration)
DEVICE_REGISTRATION_TOKEN=your-device-registration-token
```

**What to set:**
- `SESSION_SECRET`: Generate with `openssl rand -base64 32`
- `DEVICE_REGISTRATION_TOKEN`: Optional, for legacy device registration

### Optional Configuration

```bash
# API URL (for Swagger docs)
API_URL=http://localhost:3001

# Data storage path
RSYNC_TARGET_PATH=/var/fleet-data

# WiFi configuration
HQ_WIFI_SSID=HQNetwork
```

## Frontend Environment Variables

Location: `fleet-cc-server/frontend/.env`

### API Configuration

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**What to set:**
- Local development: `http://localhost:3001`
- Production: Your backend API URL (e.g., `https://api.yourdomain.com`)
- **Note**: `NEXT_PUBLIC_` prefix makes this available in the browser

### Supabase Configuration

```bash
# Supabase Auth URL
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000

# Supabase Anonymous Key (same as JWT_SECRET for self-hosted)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-jwt-secret-here
```

**What to set:**
- `NEXT_PUBLIC_SUPABASE_URL`:
  - Local: `http://localhost:8000`
  - Production: Your Supabase Auth service URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
  - For self-hosted: Same value as backend `JWT_SECRET`
  - This is safe to expose in the browser (it's the "anon" key)

## Docker Compose Environment Variables

Location: Root `.env` file (optional, used by docker-compose.yml)

```bash
# Database
POSTGRES_DB=fleet_cc
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Supabase
SUPABASE_URL=http://localhost:8000
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long
SUPABASE_SERVICE_ROLE_KEY=your-jwt-secret-here

# API
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# Frontend
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-jwt-secret-here

# Other
NODE_ENV=development
SESSION_SECRET=your-super-secret-session-token
DEVICE_REGISTRATION_TOKEN=your-device-registration-token
```

## Key Generation

### Generate JWT Secret

```bash
# Generate a secure JWT secret
openssl rand -base64 32
```

### Generate Session Secret

```bash
# Generate a secure session secret
openssl rand -base64 32
```

### Generate Device Registration Token

```bash
# Generate a device registration token
openssl rand -hex 32
```

## Important Notes

1. **Never commit `.env` files to git** - They contain secrets!

2. **JWT_SECRET and SUPABASE_SERVICE_ROLE_KEY**:
   - For self-hosted Supabase, these should be the same value
   - This value is used by both the backend and Supabase Auth service
   - Generate once and use the same value everywhere

3. **NEXT_PUBLIC_ prefix**:
   - Variables with this prefix are exposed to the browser
   - Only use for values that are safe to expose (like API URLs)
   - Never put secrets in `NEXT_PUBLIC_` variables

4. **Environment-specific values**:
   - Development: Use `localhost` URLs
   - Production: Use actual domain names and secure passwords

## Verification

After setting up your environment variables:

1. **Backend**: Check that the server starts without errors
   ```bash
   cd fleet-cc-server/backend
   npm run dev
   ```

2. **Frontend**: Check that it can connect to the backend
   ```bash
   cd fleet-cc-server/frontend
   npm run dev
   ```

3. **Supabase Auth**: Verify auth service is running
   ```bash
   curl http://localhost:9999/health
   ```

## Troubleshooting

### "Authentication required" errors
- Check that `JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` match
- Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches `JWT_SECRET` in frontend

### CORS errors
- Add your frontend URL to `CORS_ORIGIN` in backend `.env`
- Ensure no trailing slashes in URLs

### Database connection errors
- Verify `DATABASE_URL` is correct
- Check PostgreSQL is running and accessible
- Ensure database `fleet_cc` exists

### Supabase connection errors
- Verify `SUPABASE_URL` points to GoTrue service (port 9999)
- Check Supabase Auth service is running
- Verify `JWT_SECRET` matches across all services

