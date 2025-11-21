# Fixing SSH Password on Current Device

If you're unable to SSH in with the `carputer` user, you can fix it directly on the device:

## Option 1: Set Password from Console (if you have physical access)

1. Log in to the Pi console (via serial/USB or directly)
2. Run as root:
   ```bash
   passwd carputer
   ```
3. Enter the password `carputer` twice when prompted

## Option 2: Fix Shadow Entry Manually

If you have root access on the device:

```bash
# Check current shadow entry
grep carputer /etc/shadow

# Generate a new password hash (SHA256)
# On the Pi, if you have openssl:
openssl passwd -5 carputer

# Or use Python if available:
python3 -c "import crypt; print(crypt.crypt('carputer', crypt.mksalt(crypt.METHOD_SHA256)))"

# Edit /etc/shadow and replace the password field (second field) with the hash
# Example shadow entry:
# carputer:$5$EoHzCxaMX4KXlxxa$Ie8nPrItX3hgalNu/.F3pKcx.ZbKSWLH1mQuMyOeGrB:19000:0:99999:7:::
```

## Option 3: Use Root Account

If root login is enabled and you know the root password (or it's empty):

```bash
ssh root@carputer-1.local
# or
ssh root@<ip-address>
```

Then set the carputer password:
```bash
passwd carputer
```

## Default Credentials

After fixing, the credentials should be:
- **Username:** `carputer`
- **Password:** `carputer`


