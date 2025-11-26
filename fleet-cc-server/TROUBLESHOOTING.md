# Troubleshooting Guide

## Frontend Shows No Data

### Step 1: Verify Database Has Data

Run the verification script to check if data exists:

```bash
# If running in Docker
docker compose exec api npm run db:verify

# If running locally
cd backend && npm run db:verify
```

If the database is empty, run the seed script:

```bash
# If running in Docker
docker compose exec api npm run db:seed

# If running locally
cd backend && npm run db:seed
```

### Step 2: Check API is Running and Accessible

Test the API directly:

```bash
# Check if API is responding
curl http://localhost:3001/health

# Check if devices endpoint returns data
curl http://localhost:3001/api/devices

# Check if images endpoint returns data
curl http://localhost:3001/api/images
```

### Step 3: Check Frontend API Configuration

1. Verify `frontend/.env` has the correct API URL:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

2. If running in Docker, the frontend container should use `http://api:3001` for internal requests, but since the browser makes the request, `http://localhost:3001` is correct.

3. Check browser console for errors:
   - Open browser DevTools (F12)
   - Check Console tab for fetch errors
   - Check Network tab to see if API requests are failing

### Step 4: Check CORS Configuration

The backend should allow requests from `http://localhost:3000`. Check `backend/src/index.ts`:

```typescript
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
```

### Step 5: Verify Database Connection

Check if the API can connect to the database:

```bash
# Check API logs
docker compose logs api

# Look for database connection errors
```

## Supabase Studio Authentication Error

### Error: "password authentication failed for user supabase_admin"

This happens because Supabase Studio expects a `supabase_admin` role that doesn't exist by default.

### Solution 1: Run Migration (Recommended)

Run the migration to create the `supabase_admin` role:

```bash
# If running in Docker
docker compose exec api npm run db:migrate

# If running locally
cd backend && npm run db:migrate
```

This will run migration `004_create_supabase_admin.sql` which creates the role.

### Solution 2: Manual Fix

Connect to the database and create the role manually:

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U postgres -d fleet_cc

# Then run:
CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'postgres' SUPERUSER;
GRANT ALL PRIVILEGES ON DATABASE fleet_cc TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_admin;
```

### Solution 3: Use Postgres User Instead

If you don't need Supabase Studio, you can use a regular PostgreSQL client like pgAdmin or DBeaver with:
- Host: `localhost`
- Port: `5432`
- Database: `fleet_cc`
- User: `postgres`
- Password: `postgres` (or your configured password)

## Common Issues

### Database Connection String

Make sure `DATABASE_URL` in `backend/.env` matches your setup:

- **Docker**: `postgres://postgres:postgres@postgres:5432/fleet_cc`
- **Local**: `postgres://postgres:postgres@localhost:5432/fleet_cc`

### Port Conflicts

If ports are already in use:

1. Check what's using the ports:
   ```bash
   lsof -i :3000  # Frontend
   lsof -i :3001  # API
   lsof -i :5432  # PostgreSQL
   lsof -i :8080  # Supabase Studio
   ```

2. Change ports in `docker-compose.yml` or stop conflicting services

### Environment Variables Not Loading

1. Make sure `.env` files exist:
   - `backend/.env`
   - `frontend/.env`

2. Restart services after changing `.env`:
   ```bash
   docker compose restart api frontend
   ```

### Data Not Persisting

If data disappears after restarting containers:

1. Check if volumes are properly mounted:
   ```bash
   docker compose ps
   docker volume ls
   ```

2. Verify `postgres_data` volume exists and is mounted

## Getting Help

1. Check service logs:
   ```bash
   docker compose logs api
   docker compose logs frontend
   docker compose logs postgres
   ```

2. Verify all services are running:
   ```bash
   docker compose ps
   ```

3. Test database connection:
   ```bash
   docker compose exec postgres psql -U postgres -d fleet_cc -c "SELECT COUNT(*) FROM devices;"
   ```

