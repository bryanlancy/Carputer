# Authentication Setup Guide

This guide explains how authentication is configured in the Fleet Command & Control system.

## Overview

The system uses **Supabase Auth** (GoTrue) for authentication with the following components:

1. **Frontend**: Supabase client for user login/signup
2. **Backend**: JWT token verification via Supabase Auth
3. **Database**: Row Level Security (RLS) policies for data protection
4. **WebSocket**: Token-based authentication for realtime connections

## Authentication Flow

1. User logs in via frontend → Supabase Auth issues JWT token
2. Frontend stores token and includes in API requests
3. Backend verifies token with Supabase Auth
4. Backend checks user exists in database (syncs if needed)
5. Request proceeds with authenticated user context

## Protected Endpoints

### Public Endpoints (No Auth Required)
- `GET /health` - Health check
- `POST /api/devices/register` - Device registration
- `POST /api/devices/register/auto` - Automatic device registration
- `POST /api/devices/heartbeat` - Device heartbeat (uses deviceAuth)

### Protected Endpoints (Auth Required)
- All `/api/commands/*` endpoints
- All `/api/metrics/*` endpoints
- All `/api/images/*` endpoints
- All `/api/verified-images/*` endpoints
- All `/api/notifications/*` endpoints
- All `/api/admin/*` endpoints
- All `/api/realtime/*` endpoints (including WebSocket)
- `GET /api/devices` - List devices
- `GET /api/devices/:deviceId` - Get device details

## Backend Authentication

### Middleware

The backend uses two authentication middlewares:

1. **`authenticate`**: Optional auth - extracts user from token if present
   - Applied globally to all routes
   - Doesn't block requests if no token

2. **`requireAuth`**: Required auth - blocks requests without valid token
   - Applied to protected routes
   - Returns 401 if no user authenticated

### Token Verification

Tokens are verified in this order:
1. Try JWT verification with `JWT_SECRET`
2. If that fails, verify with Supabase Auth API
3. Look up user in database (create if needed from Supabase)

## Frontend Authentication

### Auth Context

The frontend uses `AuthContext` to manage authentication state:
- Provides `useAuth()` hook
- Handles login/logout
- Manages session persistence
- Redirects unauthenticated users to login

### Route Protection

- `AuthGuard` component wraps all routes
- Redirects to `/login` if not authenticated
- Allows access to `/login` page without auth

### API Requests

All API requests automatically include auth token:
- `authenticatedFetch()` utility adds Bearer token
- WebSocket connections include token in query params

## WebSocket Authentication

WebSocket connections require authentication:
- Token passed via `token` query parameter or `Authorization` header
- Server verifies token on connection
- Connection rejected if token invalid or missing
- User info stored with connection for targeted broadcasts

## Database Security (RLS)

Row Level Security policies protect sensitive data:

### Users Table
- Users can only read/update their own data
- Backend service role has full access

### User Roles Table
- Users can read their own roles
- Role assignment handled by backend (admin only)

### User Notifications Table
- Users can read/update their own notifications
- Notification creation handled by backend

### Other Tables
- Device, command, image, notification tables accessed via API only
- Backend service role has full access
- RLS not enabled (API handles authorization)

## Environment Variables

See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) for complete setup.

Key variables:
- `JWT_SECRET`: Must match across all services
- `SUPABASE_SERVICE_ROLE_KEY`: Same as `JWT_SECRET` for self-hosted
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Same as `JWT_SECRET` for self-hosted

## Running RLS Migration

To enable Row Level Security policies:

```bash
# Connect to database
psql -U postgres -d fleet_cc

# Run migration
\i fleet-cc-server/backend/src/db/migrations/008_enable_rls.sql
```

Or via Prisma (if configured):
```bash
cd fleet-cc-server/backend
npx prisma db execute --file src/db/migrations/008_enable_rls.sql
```

## Testing Authentication

### Test Login
1. Start all services
2. Navigate to `http://localhost:3000`
3. Should redirect to `/login`
4. Create account or login
5. Should redirect to dashboard

### Test Protected Endpoint
```bash
# Without token (should fail)
curl http://localhost:3001/api/metrics/overview

# With token (should succeed)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/metrics/overview
```

### Test WebSocket
```javascript
// In browser console (after login)
const token = 'YOUR_ACCESS_TOKEN';
const ws = new WebSocket(`ws://localhost:3001/api/realtime/ws?token=${token}&channels=devices,metrics`);
```

## Troubleshooting

### "Authentication required" errors
- Check `JWT_SECRET` matches across all services
- Verify Supabase Auth service is running
- Check token is being sent in requests

### WebSocket connection fails
- Verify token is included in query params
- Check token is valid (not expired)
- Ensure user exists in database

### RLS blocking queries
- Verify RLS policies are correct
- Check user has proper roles
- Backend service role bypasses RLS

## Security Best Practices

1. **Never commit `.env` files** - Contains secrets
2. **Use strong JWT secrets** - At least 32 characters
3. **Rotate secrets regularly** - Especially in production
4. **Use HTTPS in production** - Protect tokens in transit
5. **Monitor auth failures** - Watch for brute force attempts
6. **Limit admin access** - Only grant admin role to trusted users

