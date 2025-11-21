# Network Debugging Guide

## Quick Status Check

Once you have SSH access or a shell on the Pi, run:

```bash
carputer-network-status
```

This will show:
- Network interface status
- wpa_supplicant status
- Avahi status
- DBus status
- Network configuration files
- Recent network-related kernel messages

## Manual Network Debugging Steps

### 1. Check if network interfaces exist
```bash
ip addr show
# or
ifconfig -a
```

### 2. Check if wlan0 is up
```bash
ip link show wlan0
# Should show "state UP" if the interface is up
```

### 3. Check wpa_supplicant
```bash
# Check if it's running
pgrep -a wpa_supplicant

# Check status
wpa_cli -i wlan0 status

# Check configuration
cat /etc/wpa_supplicant/wpa_supplicant.conf
```

### 4. Manually bring up wlan0
```bash
# Try to bring up the interface manually
ifup wlan0

# Check for errors
dmesg | tail -20
```

### 5. Check Avahi/mDNS
```bash
# Check if avahi-daemon is running
pgrep -a avahi-daemon

# Check if it's advertising
avahi-browse -a

# Check hostname
hostname
cat /etc/hostname
```

### 6. Check network init scripts
```bash
# Check if S40network exists and ran
ls -la /etc/init.d/S40network
cat /etc/init.d/S40network

# Check if interfaces are configured
cat /etc/network/interfaces
cat /etc/network/interfaces.d/wlan0
```

## Common Issues

### Issue: wlan0 interface doesn't exist
**Solution**: Check if Wi-Fi firmware is loaded:
```bash
dmesg | grep -i brcmfmac
lsmod | grep brcmfmac
```

### Issue: wpa_supplicant not running
**Solution**: Check configuration and start manually:
```bash
# Check config
cat /etc/wpa_supplicant/wpa_supplicant.conf

# Start manually
wpa_supplicant -B -i wlan0 -c /etc/wpa_supplicant/wpa_supplicant.conf
```

### Issue: Interface up but no IP address
**Solution**: Check DHCP client:
```bash
# Check if DHCP is working
udhcpc -i wlan0

# Or check dhcpcd if it's installed
dhcpcd wlan0
```

### Issue: Avahi not working
**Solution**: Ensure DBus is running first:
```bash
# Start DBus
/etc/init.d/S40dbus start

# Then start Avahi
/etc/init.d/S50avahi-daemon start
```

## Testing SSH Connection

Once network is up, test SSH:
```bash
# From your development machine
ssh carputer@carputer-1.local

# Or if mDNS isn't working, find the IP:
# On the Pi:
ip addr show wlan0 | grep inet

# Then SSH with IP:
ssh carputer@<IP_ADDRESS>
```



