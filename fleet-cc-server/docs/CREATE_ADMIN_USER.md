# Creating Default Admin User

This guide explains how to create a default admin user for the Fleet Command & Control system.

## Prerequisites

1. **Docker containers must be running**:
   ```bash
   cd fleet-cc-server
   docker-compose up -d
   ```

2. **Environment variables must be set**:
   - `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` in `backend/.env`
   - `DATABASE_URL` in `backend/.env`

## Create Admin User

Run the script:

```bash
cd fleet-cc-server/backend
npm run db:create-admin
```

Or directly:

```bash
cd fleet-cc-server/backend
npx tsx src/scripts/create-admin-user.ts
```

## Default Credentials

After running the script, you'll receive:

- **Email**: `admin@fleetcc.local`
- **Password**: `admin123`

⚠️ **IMPORTANT**: Change this password immediately after first login!

## Troubleshooting

### "Database error finding users" or "column users.aud does not exist"

**Solution**: Ensure the `GOTRUE_DB_DATABASE_URL` in `docker-compose.yml` includes `?search_path=auth`:

```yaml
GOTRUE_DB_DATABASE_URL: postgres://postgres:postgres@postgres:5432/fleet_cc?search_path=auth
```

Then restart the auth service:
```bash
docker compose up -d --force-recreate auth
```

## What the Script Does

1. Connects to Supabase Auth service (GoTrue on port 9999)
2. Creates a user in Supabase Auth with the default credentials
3. Creates a corresponding user record in the database
4. Assigns the `admin` role to the user

## Troubleshooting

### "Cannot connect to Supabase Auth service"

**Solution**: Ensure Docker containers are running:
```bash
docker-compose ps
docker-compose up -d
```

### "SUPABASE_SERVICE_ROLE_KEY must be set"

**Solution**: Run the key generation script:
```bash
./fleet-cc-server/scripts/generate-supabase-keys.sh
```

### "User already exists"

The script is idempotent - it's safe to run multiple times. If the user exists, it will:
- Update the password to the default
- Ensure the admin role is assigned
- Skip creating duplicate records

## Manual User Creation

If you prefer to create a user manually:

1. **Via Supabase Studio** (if running):
   - Navigate to http://localhost:8080
   - Go to Authentication > Users
   - Click "Add User"
   - Enter email and password
   - Copy the user ID

2. **Create in database**:
   ```sql
   INSERT INTO users (id, supabase_user_id, email, full_name)
   VALUES ('<user-id>', '<user-id>', 'admin@fleetcc.local', 'Admin User');

   INSERT INTO user_roles (user_id, role)
   VALUES ('<user-id>', 'admin');
   ```

## Changing the Default Password

After logging in, you can change your password through the UI (if implemented) or by updating it in Supabase Auth.

