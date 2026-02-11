# Quick Setup Guide

## Prerequisites Check
```bash
# Check Node.js version (must be 16+)
node --version

# Check npm version (must be 8+)
npm --version

# Check MySQL/MariaDB
mysql --version
```

## Installation Steps

### 1. Install Dependencies
```bash
cd substation-logbook
npm install
```

### 2. Configure Database
```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE substation_logbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Import schema
mysql -u root -p substation_logbook < database/schema.sql
```

### 3. Configure Application
```bash
# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env
```

**Important settings in .env:**
- `DB_PASSWORD`: Your MySQL root password
- `JWT_SECRET`: Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SESSION_SECRET`: Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SMTP_USER` and `SMTP_PASSWORD`: Your email credentials

### 4. Update Admin Password
```bash
# Generate password hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YourNewPassword123', 10).then(hash => console.log(hash));"

# Copy the output hash, then:
mysql -u root -p substation_logbook
UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';
EXIT;
```

### 5. Start Application
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

### 6. Access Application
Open browser: http://localhost:3000

**Default Login:**
- Username: `admin`
- Password: (the password you set in step 4)

## Gmail SMTP Setup (for email notifications)

1. Go to https://myaccount.google.com/apppasswords
2. Sign in with your Google account
3. Select app: Mail
4. Select device: Other (Custom name) → "Substation Logbook"
5. Click Generate
6. Copy the 16-character app password
7. Update .env:
   ```
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```

## First Tasks

### Add Your First Substation
1. Login as admin
2. Go to Substations → Add Substation
3. Fill in details (code, name, password)
4. Save

### Add Engineer
1. Go to Users → Add User
2. Select Role: Engineer
3. Assign to substation
4. Save

### Add Technicians
1. Go to Technicians menu
2. Select substation
3. Add technician details
4. Save

## Troubleshooting

### Port 3000 already in use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### Database connection fails
```bash
# Test MySQL connection
mysql -u root -p -h localhost

# Check if database exists
SHOW DATABASES;

# Verify credentials in .env match MySQL
```

### Email not sending
- For Gmail: Ensure App Password is used (not regular password)
- Check firewall allows outbound connections on port 587
- Test SMTP settings in Admin → Settings → Email Config

## Production Deployment

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name substation-logbook

# Auto-start on system boot
pm2 startup
pm2 save

# View logs
pm2 logs substation-logbook

# Restart
pm2 restart substation-logbook
```

### Enable HTTPS (Production)
1. Install certbot
2. Get SSL certificate
3. Configure reverse proxy (nginx/apache)
4. Update APP_URL in .env to https://

## Backup Schedule

**Automatic:** Daily at 2:00 AM (keeps last 90 days)
**Manual:** Admin → Settings → Backup → Create Backup

## Support

For issues:
- Check README.md for detailed documentation
- Review logs: `pm2 logs substation-logbook`
- Check database connectivity
- Verify .env configuration

---
System by NAG - SDSC SHAR CMG
