# Device Online/Offline Establishment Process

## Overview

This document describes the process by which devices establish their online status with the Fleet Command & Control Server, and how the notification system tracks device connection state changes. This process is designed to be implemented on the device side (carputer stack) in a future update.

## Device Status Lifecycle

Devices transition through the following status states:

1. **`offline`** (default): Device is not connected or has not established connection
2. **`online`**: Device has successfully connected and is actively communicating
3. **`stale`** (future): Device was online but hasn't sent a heartbeat recently
4. **`maintenance`** (future): Device is in maintenance mode

## Establishing Online Status

### 1. Initial Registration (Coming Online)

When a device first connects to the server or reconnects after being offline, it must:

**Step 1: Automatic Registration**

Send a registration request to establish its identity:

```http
POST /api/devices/register/auto
Content-Type: application/json

{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "imageBuildHash": "abc123def456...",
  "deviceId": "carputer-001",  // Optional
  "hostname": "carputer-device",
  "version": "1.0.0",
  "buildId": "2024.01.15",
  "ip": "192.168.1.100"
}
```

**What happens on the server:**
- Server verifies the device's image build hash
- If the device is new or was previously `offline`, the server:
  - Updates device status to `online`
  - Updates `last_seen` timestamp
  - **Creates a notification** of type `device.online`

**Device receives:**
```json
{
  "device": { ... },
  "message": "Device registered successfully",
  "authorized": true,
  "imageVerified": true
}
```

**Step 2: Start Sending Heartbeats**

After successful registration, devices should immediately begin sending periodic heartbeats:

```http
POST /api/devices/heartbeat
Content-Type: application/json
X-Device-MAC: AA:BB:CC:DD:EE:FF

{
  "macAddress": "AA:BB:CC:DD:EE:FF",
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

**Heartbeat frequency:**
- Devices should send heartbeats every **30-60 seconds** while online
- If a heartbeat fails, retry immediately
- If multiple heartbeats fail, back off exponentially (30s, 60s, 120s, etc.)
- Maximum backoff: 5 minutes

**What happens on the server:**
- If the device was previously `offline`, the server:
  - Updates device status to `online`
  - Updates `last_seen` timestamp
  - **Creates a notification** of type `device.online`

### 2. Maintaining Online Status

To maintain online status, devices must:

1. **Send regular heartbeats** (every 30-60 seconds)
2. **Handle heartbeat failures gracefully**:
   - If heartbeat returns 403 (unauthorized), stop trying and alert user
   - If heartbeat returns 404 (device not found), re-register
   - If heartbeat fails due to network error, retry with backoff

3. **Update status information**:
   - Include current IP address
   - Include uptime
   - Include service status
   - Include version/build information

### 3. Transitioning to Offline Status

Devices transition to offline status when:

1. **Device stops sending heartbeats** (handled by server-side monitoring - future feature)
2. **Device explicitly goes offline** (shutdown, sleep mode, etc.) - **not yet implemented**

**Future Implementation:**

When a device is shutting down or going to sleep, it should:

```http
POST /api/devices/offline
Content-Type: application/json
X-Device-MAC: AA:BB:CC:DD:EE:FF

{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "reason": "shutdown" | "sleep" | "network_disconnect"
}
```

This would:
- Update device status to `offline`
- Update `last_seen` timestamp
- **Create a notification** of type `device.offline`

## Network Connection Strategy

### Initial Connection

When a device boots up or regains network connectivity, it should:

1. **Wait for network connection**: Ensure network interface is up and has an IP address
2. **Resolve server address**: Resolve the server hostname/IP from configuration
3. **Establish connection**: Attempt to connect to the server
4. **Register**: Send registration request immediately upon connection
5. **Start heartbeats**: Begin sending heartbeats after successful registration

### Connection Retry Logic

If initial connection fails:

1. **Immediate retry**: Retry connection after 5 seconds
2. **Exponential backoff**: Double retry interval on each failure (5s, 10s, 20s, 40s, 80s)
3. **Maximum backoff**: Cap at 5 minutes
4. **Continuous monitoring**: Continue attempting to connect in background

### Network State Monitoring

Devices should monitor network connectivity:

- **Network interface state changes**: React to interface up/down events
- **IP address changes**: Re-register if IP address changes significantly
- **DNS resolution**: Cache server IP address, but re-resolve periodically
- **Connection quality**: Monitor latency and packet loss

## Implementation Checklist for Device Side

To implement the online/offline establishment process on the device side, the following components are needed:

### 1. Network Connection Manager

- [ ] Monitor network interface state
- [ ] Detect network connectivity
- [ ] Resolve server address
- [ ] Handle network state changes
- [ ] Implement connection retry logic

### 2. Registration Service

- [ ] Send registration request on boot/network connect
- [ ] Handle registration responses
- [ ] Store registration state
- [ ] Re-register on IP change or after network reconnection
- [ ] Handle registration failures gracefully

### 3. Heartbeat Service

- [ ] Send periodic heartbeats (30-60 second interval)
- [ ] Handle heartbeat responses
- [ ] Implement heartbeat retry logic
- [ ] Back off on failures
- [ ] Stop heartbeats on shutdown

### 4. Status Management

- [ ] Track device status locally
- [ ] Update status on registration success
- [ ] Update status on heartbeat success
- [ ] Send offline notification on shutdown (future)

### 5. Configuration Management

- [ ] Store server URL/hostname
- [ ] Store device MAC address
- [ ] Store image build hash
- [ ] Store device metadata (hostname, VIN, etc.)
- [ ] Provide configuration interface

## Server-Side Notification System

The server automatically creates notifications when devices change status:

### Online Notifications

Created when:
- A new device registers (status changes from `null` to `online`)
- An existing device registers and was previously `offline`
- A device sends a heartbeat and was previously `offline`

Notification includes:
- Device information (hostname, device ID)
- IP address
- Timestamp
- Metadata (registration method, image verification status, etc.)

### Offline Notifications (Future)

Will be created when:
- A device explicitly goes offline (sends offline notification)
- A device hasn't sent a heartbeat in X minutes (configurable threshold)
- A device's connection is lost and detected by server monitoring

Notification will include:
- Device information
- Last seen timestamp
- Reason for going offline (if available)

### Notification API

Retrieve notifications:

```http
GET /api/notifications
GET /api/notifications?unreadOnly=true
GET /api/notifications?deviceId=1
GET /api/notifications?typeCode=device.online
```

Get notifications for a specific device:

```http
GET /api/notifications/device/{deviceId}
```

Mark notifications as read:

```http
POST /api/notifications/{notificationId}/read
POST /api/notifications/device/{deviceId}/read-all
```

Get unread count:

```http
GET /api/notifications/unread-count
GET /api/notifications/unread-count?deviceId=1
```

## Device Configuration

Devices need the following configuration:

```toml
# Fleet CC Server Configuration
[fleet_cc]
server_url = "http://fleet-cc-server.local:3001"
heartbeat_interval = 60  # seconds
heartbeat_timeout = 10   # seconds
registration_retry_interval = 5  # seconds
max_heartbeat_backoff = 300  # seconds (5 minutes)

[device]
mac_address = "AA:BB:CC:DD:EE:FF"  # Auto-detected
hostname = "carputer-001"
vin = "1HGBH41JXMN109186"  # Optional
hardware_rev = "v2.1"  # Optional
```

## Error Handling

### Registration Failures

- **403 Forbidden (Image not verified)**: Device image is not authorized. Alert user, stop trying.
- **409 Conflict (Device ID conflict)**: Device ID already in use. Use auto-generated ID or resolve conflict.
- **Network errors**: Retry with exponential backoff, continue in background.

### Heartbeat Failures

- **403 Forbidden (Not authorized)**: Device authorization revoked. Stop sending heartbeats, alert user.
- **404 Not Found**: Device not found. Re-register immediately.
- **Network errors**: Retry with exponential backoff. Continue trying in background.

## Testing Checklist

Before implementing on devices, test:

- [ ] Registration succeeds for new devices
- [ ] Registration succeeds for existing devices (re-registration)
- [ ] Heartbeats maintain online status
- [ ] Status transitions from offline to online create notifications
- [ ] Heartbeat failures are handled gracefully
- [ ] Network disconnection is detected
- [ ] Reconnection triggers re-registration
- [ ] IP address changes are handled correctly

## Future Enhancements

- **WebSocket/Realtime Connection**: Use WebSocket for real-time bidirectional communication
- **Push Notifications**: Server can push commands/updates to devices immediately
- **Connection Quality Metrics**: Track latency, packet loss, connection stability
- **Automatic Offline Detection**: Server-side monitoring detects stale devices
- **Graceful Shutdown**: Devices send explicit offline notification before shutdown
- **Connection State Machine**: Formal state machine for connection states
- **Multi-Server Support**: Devices can connect to multiple servers for redundancy

## References

- [Device Registration Documentation](./DEVICE_REGISTRATION.md)
- [Notification System API](../../backend/src/routes/notifications.ts)
- [Notification Service](../../backend/src/services/notification.ts)

