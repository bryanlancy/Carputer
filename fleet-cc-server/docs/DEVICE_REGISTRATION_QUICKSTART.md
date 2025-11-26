# Device Registration Quick Start Guide

This guide provides a quick reference for setting up automatic device registration.

## Prerequisites

1. Fleet CC Server is running
2. Database migrations have been run: `npm run db:migrate`
3. You have the image build hash for your carputer image

## Step 1: Add Verified Image

Before devices can register, you must add the carputer image to the verified images list.

### Using cURL

```bash
curl -X POST http://localhost:3001/api/verified-images \
  -H "Content-Type: application/json" \
  -d '{
    "imageBuildHash": "YOUR_IMAGE_BUILD_HASH",
    "buildId": "2024.01.15",
    "gitSha": "a1b2c3d4",
    "verifiedBy": "admin",
    "notes": "Production release"
  }'
```

### Using HTTPie

```bash
http POST http://localhost:3001/api/verified-images \
  imageBuildHash="YOUR_IMAGE_BUILD_HASH" \
  buildId="2024.01.15" \
  gitSha="a1b2c3d4" \
  verifiedBy="admin" \
  notes="Production release"
```

### Response

```json
{
  "message": "Verified image added successfully",
  "image": {
    "id": 1,
    "image_build_hash": "YOUR_IMAGE_BUILD_HASH",
    "is_active": true,
    ...
  }
}
```

## Step 2: Device Registration

Once the image is verified, devices will automatically register when they first connect.

### Device Registration Request

The device should send a POST request to `/api/devices/register/auto`:

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "imageBuildHash": "YOUR_IMAGE_BUILD_HASH",
  "hostname": "carputer-001",
  "buildId": "2024.01.15",
  "version": "1.0.0"
}
```

### Required Fields

- `macAddress`: Device MAC address (format: `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`)
- `imageBuildHash`: Must match a verified image

### Optional Fields

- `deviceId`: Auto-generated if not provided
- `hostname`, `vin`, `hardwareRev`: Device metadata
- `imageSignature`: For cryptographic verification
- `version`, `ip`: Current device state

## Step 3: Verify Registration

Check that the device is registered:

```bash
curl http://localhost:3001/api/devices
```

Or get a specific device:

```bash
curl http://localhost:3001/api/devices/carputer-001
```

## Step 4: Device Heartbeat

After registration, devices should send periodic heartbeats:

```bash
curl -X POST http://localhost:3001/api/devices/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-Device-MAC: AA:BB:CC:DD:EE:FF" \
  -d '{
    "version": "1.0.0",
    "uptime": 3600,
    "ip": "192.168.1.100"
  }'
```

## Common Tasks

### List All Verified Images

```bash
curl http://localhost:3001/api/verified-images
```

### Deactivate an Image

```bash
curl -X DELETE http://localhost:3001/api/verified-images/YOUR_IMAGE_BUILD_HASH
```

### Check Registration Attempts

Query the database to see registration attempts:

```sql
SELECT * FROM device_registration_attempts
ORDER BY created_at DESC
LIMIT 10;
```

## Troubleshooting

### "Image not verified" Error

**Problem:** Device registration fails with 403 error.

**Solution:**
1. Verify the image build hash is correct
2. Check the image is in verified images: `GET /api/verified-images`
3. Ensure `is_active = true` for the image
4. Add the image if missing: `POST /api/verified-images`

### Device Not Found in Heartbeat

**Problem:** Heartbeat returns 404 "Device not found".

**Solution:**
1. Ensure device registered successfully first
2. Check MAC address format matches registration
3. Verify device exists: `GET /api/devices`

### Device Not Authorized

**Problem:** Heartbeat returns 403 "Device not authorized".

**Solution:**
- For automatic registration: Should auto-authorize if image is verified
- Check database: `SELECT authorized FROM devices WHERE mac_address = '...'`
- If false, update: `UPDATE devices SET authorized = true WHERE mac_address = '...'`

## Example: Complete Flow

```bash
# 1. Add verified image
curl -X POST http://localhost:3001/api/verified-images \
  -H "Content-Type: application/json" \
  -d '{
    "imageBuildHash": "sha256:abc123",
    "buildId": "dev-001",
    "verifiedBy": "admin"
  }'

# 2. Device registers (simulated)
curl -X POST http://localhost:3001/api/devices/register/auto \
  -H "Content-Type: application/json" \
  -d '{
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "imageBuildHash": "sha256:abc123",
    "hostname": "test-device"
  }'

# 3. Device sends heartbeat
curl -X POST http://localhost:3001/api/devices/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-Device-MAC: AA:BB:CC:DD:EE:FF" \
  -d '{"version": "1.0.0"}'

# 4. Verify device is online
curl http://localhost:3001/api/devices
```

## Next Steps

- See [DEVICE_REGISTRATION.md](./DEVICE_REGISTRATION.md) for detailed documentation
- Integrate registration into your carputer image build process
- Set up automated image verification in CI/CD pipeline


