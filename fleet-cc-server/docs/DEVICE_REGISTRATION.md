# Device Registration System

## Overview

The Fleet Command & Control Server implements an automatic device registration system that ensures only devices running verified carputer images can connect to the server. Devices are identified by their MAC address, which provides a stable hardware-based identifier that persists across software updates.

## Key Features

- **Automatic Registration**: Devices register themselves automatically on first connection
- **Hardware-Based Identification**: MAC address is used as the primary device identifier
- **Image Verification**: Only devices running verified carputer images can register
- **Update Resilience**: Devices can re-register after updates while maintaining their identity
- **Authorization Tracking**: Devices are automatically authorized when running verified images

## Architecture

### Database Schema

The system uses the following key database tables:

- **`devices`**: Stores device information including MAC address, image verification status, and authorization
- **`verified_images`**: Tracks which carputer image builds are authorized for registration
- **`device_registration_attempts`**: Audit log of all registration attempts (successful and failed)

### Key Fields

#### Devices Table
- `mac_address`: Primary hardware identifier (unique)
- `device_id`: Human-readable device identifier (can be auto-generated from MAC)
- `image_build_hash`: Hash of the carputer image the device is running
- `image_signature`: Cryptographic signature of the image (optional)
- `image_verified`: Boolean indicating if the image is verified
- `authorized`: Boolean indicating if the device is authorized to connect
- `registration_method`: Either 'auto' (automatic) or 'manual' (legacy)

#### Verified Images Table
- `image_build_hash`: Unique hash identifying the image build
- `image_signature`: Expected signature for the image (optional)
- `is_active`: Whether this image is currently allowed for registration
- `build_id`, `git_sha`: Build metadata for tracking

## Registration Flow

### 1. Device Registration Request

When a device first connects, it sends a registration request to:

```
POST /api/devices/register/auto
```

**Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "deviceId": "carputer-001",  // Optional, auto-generated if not provided
  "hostname": "carputer-device",
  "vin": "1HGBH41JXMN109186",  // Optional
  "hardwareRev": "v2.1",       // Optional
  "buildId": "2024.01.15",
  "imageBuildHash": "abc123def456...",  // Required
  "imageSignature": "signature...",     // Optional
  "version": "1.0.0",
  "ip": "192.168.1.100"
}
```

**Required Fields:**
- `macAddress`: Device MAC address (format: `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`)
- `imageBuildHash`: Hash of the carputer image build

**Optional Fields:**
- `deviceId`: If not provided, will be auto-generated as `carputer-{mac_address}`
- `imageSignature`: For cryptographic signature verification
- Other metadata fields (hostname, VIN, hardware revision, etc.)

### 2. Image Verification

The server verifies that the device is running an authorized carputer image:

1. Checks if `imageBuildHash` exists in the `verified_images` table
2. Verifies the image is marked as `is_active = true`
3. If `imageSignature` is provided, verifies it matches the stored signature

**If verification fails:**
- Registration is rejected with HTTP 403
- Attempt is logged in `device_registration_attempts` table
- Device cannot connect to the server

**If verification succeeds:**
- Device registration proceeds

### 3. Device Registration/Update

The server checks if a device with this MAC address already exists:

**New Device:**
- Creates new device record
- Sets `authorized = true` (automatic authorization for verified images)
- Sets `authorized_by = 'auto'`
- Sets `registration_method = 'auto'`
- Returns HTTP 201

**Existing Device (Re-registration):**
- Updates device information (handles updates during development)
- Updates image verification status
- Maintains authorization status
- Returns HTTP 200

### 4. Response

**Success Response (201 for new, 200 for update):**
```json
{
  "device": {
    "id": 1,
    "device_id": "carputer-001",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "authorized": true,
    "image_verified": true,
    ...
  },
  "message": "Device registered successfully",
  "authorized": true
}
```

**Error Responses:**
- `400`: Validation error (invalid MAC format, missing required fields)
- `403`: Image not verified (device running unauthorized image)
- `409`: Device ID conflict (if device ID already exists for different MAC)
- `500`: Internal server error

## Heartbeat System

After registration, devices send periodic heartbeats to indicate they're online:

```
POST /api/devices/heartbeat
```

**Request Headers (preferred):**
```
X-Device-MAC: AA:BB:CC:DD:EE:FF
```

**Or Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "deviceId": "carputer-001",
  "version": "1.0.0",
  "buildId": "2024.01.15",
  "uptime": 3600,
  "ip": "192.168.1.100",
  "services": {
    "carputer-hub": true,
    "network": true
  }
}
```

**Authentication:**
- Device must be registered (found by MAC address or device ID)
- Device must be authorized (`authorized = true`)

**Response:**
```json
{
  "status": "ok",
  "deviceId": "carputer-001",
  "authorized": true,
  "pendingCommands": [...]
}
```

## Image Verification Management

### Adding Verified Images

To allow devices to register with a new carputer image, add it to the verified images list:

```
POST /api/verified-images
```

**Request Body:**
```json
{
  "imageBuildHash": "abc123def456...",
  "imageSignature": "signature...",  // Optional
  "buildId": "2024.01.15",
  "gitSha": "a1b2c3d4e5f6...",
  "buildTimestamp": "2024-01-15T10:30:00Z",
  "verifiedBy": "admin",
  "notes": "Production release 1.0"
}
```

### Listing Verified Images

```
GET /api/verified-images?activeOnly=true
```

Returns all verified images (active only by default).

### Deactivating Images

To prevent new devices from registering with an image (e.g., after discovering a security issue):

```
DELETE /api/verified-images/{buildHash}
```

This sets `is_active = false` for the image. Existing devices are not affected.

## Device Identification

### MAC Address Format

MAC addresses should be provided in one of these formats:
- `AA:BB:CC:DD:EE:FF` (colon-separated)
- `AA-BB-CC-DD-EE-FF` (dash-separated)

The system normalizes and stores MAC addresses consistently.

### Device ID Generation

If `deviceId` is not provided during registration, it's auto-generated as:
```
carputer-{mac_address_without_separators}
```

Example: MAC `AA:BB:CC:DD:EE:FF` → Device ID `carputer-aabbccddeeff`

## Security Considerations

### Image Verification

- Only verified images can register devices
- Image signatures provide additional cryptographic verification
- Deactivated images cannot be used for new registrations

### Authorization

- Devices with verified images are automatically authorized
- Manual registration (legacy) requires explicit authorization
- Unauthorized devices cannot send heartbeats or receive commands

### Audit Trail

All registration attempts are logged in `device_registration_attempts`:
- Successful registrations
- Failed attempts (unauthorized images, invalid signatures, etc.)
- IP addresses and timestamps

## Development Workflow

### During Development

1. **Build a new carputer image** with your changes
2. **Generate image build hash** (e.g., SHA256 of the image file)
3. **Add verified image** to the server:
   ```bash
   curl -X POST http://localhost:3001/api/verified-images \
     -H "Content-Type: application/json" \
     -d '{
       "imageBuildHash": "your-build-hash",
       "buildId": "dev-2024.01.15",
       "gitSha": "your-git-sha",
       "verifiedBy": "developer"
     }'
   ```
4. **Flash device** with the new image
5. **Device automatically registers** on first connection

### Re-registration After Updates

When a device is updated with a new image:
- Device sends registration request with new `imageBuildHash`
- Server verifies the new image is in verified images list
- If verified, device record is updated (same MAC address)
- Device maintains its identity and authorization

## API Reference

### Automatic Device Registration

**Endpoint:** `POST /api/devices/register/auto`

**Authentication:** None (public endpoint, but requires verified image)

**Request:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "imageBuildHash": "abc123...",
  "deviceId": "optional",
  "hostname": "optional",
  "vin": "optional",
  "hardwareRev": "optional",
  "buildId": "optional",
  "imageSignature": "optional",
  "version": "optional",
  "ip": "optional"
}
```

**Response (201/200):**
```json
{
  "device": { ... },
  "message": "Device registered successfully",
  "authorized": true
}
```

### Heartbeat

**Endpoint:** `POST /api/devices/heartbeat`

**Authentication:** Device must be registered and authorized

**Request Headers:**
```
X-Device-MAC: AA:BB:CC:DD:EE:FF
```

**Or Request Body:**
```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "deviceId": "optional",
  "version": "optional",
  "buildId": "optional",
  "uptime": "optional",
  "ip": "optional",
  "services": { ... }
}
```

**Response:**
```json
{
  "status": "ok",
  "deviceId": "carputer-001",
  "authorized": true,
  "pendingCommands": []
}
```

### Verified Images Management

**Add Verified Image:** `POST /api/verified-images`

**List Verified Images:** `GET /api/verified-images?activeOnly=true`

**Get Verified Image:** `GET /api/verified-images/{buildHash}`

**Deactivate Image:** `DELETE /api/verified-images/{buildHash}`

## Troubleshooting

### Device Registration Fails with "Image not verified"

**Problem:** Device is running an image that's not in the verified images list.

**Solution:**
1. Get the `imageBuildHash` from the device or build process
2. Add it to verified images using the API
3. Retry device registration

### Device Not Authorized

**Problem:** Device is registered but `authorized = false`.

**Solution:**
- For automatic registration: Ensure the image is verified (should auto-authorize)
- For manual registration: Device needs explicit authorization (update `authorized = true` in database)

### MAC Address Already Registered

**Problem:** MAC address is already registered to a different device ID.

**Solution:**
- This is expected behavior - the same hardware should use the same MAC address
- The system will update the existing device record on re-registration
- If you need to change the device ID, update it in the database

### Device ID Conflict

**Problem:** Device ID is already registered to a different MAC address.

**Solution:**
- Use a different device ID, or
- Let the system auto-generate the device ID from MAC address

## Database Migrations

Run migrations to set up the database schema:

```bash
npm run db:migrate
```

This will run all migration files in order:
- `001_initial_schema.sql`: Initial database schema
- `002_device_registration_enhancements.sql`: Device registration enhancements

## Example: Complete Registration Flow

### 1. Add Verified Image

```bash
curl -X POST http://localhost:3001/api/verified-images \
  -H "Content-Type: application/json" \
  -d '{
    "imageBuildHash": "sha256:abc123def456...",
    "buildId": "2024.01.15",
    "gitSha": "a1b2c3d4",
    "verifiedBy": "admin"
  }'
```

### 2. Device Registers Automatically

```bash
curl -X POST http://localhost:3001/api/devices/register/auto \
  -H "Content-Type: application/json" \
  -d '{
    "macAddress": "AA:BB:CC:DD:EE:FF",
    "imageBuildHash": "sha256:abc123def456...",
    "hostname": "carputer-001",
    "buildId": "2024.01.15",
    "version": "1.0.0"
  }'
```

### 3. Device Sends Heartbeat

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

## Future Enhancements

Potential improvements to the registration system:

- **Cryptographic Signature Verification**: Implement proper cryptographic verification of image signatures (e.g., using public key infrastructure)
- **Certificate-Based Authentication**: Use device certificates for authentication instead of just MAC addresses
- **Registration Tokens**: Optional registration tokens for additional security
- **Bulk Image Verification**: API endpoint to verify multiple images at once
- **Registration Webhooks**: Notify external systems when devices register
- **Device Groups**: Organize devices into groups for easier management


