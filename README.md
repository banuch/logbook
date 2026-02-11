# Electrical Substation Logbook Management System

A comprehensive web-based logbook management system for electrical substations at SDSC SHAR (ISRO).

## 🎉 **Latest Update - All Features Complete!**

**All pending features from the SRS document have been successfully implemented!**

👉 **See [FEATURES.md](FEATURES.md) for complete feature documentation and user guide.**

New additions include:
- ✅ Technicians Management Page (Full CRUD)
- ✅ Substations Management Page (Full CRUD)  
- ✅ Users Management Page (Full CRUD)
- ✅ Settings Page (Email, Equipment, Categories, Backups)
- ✅ Reports Page (Daily/Monthly Summaries)
- ✅ Context Menu for Message Field (#, @, /, &)
- ✅ Password Validation UI with Strength Indicator

---

## 📋 Features

### Core Functionality
- ✅ **Multi-level Authentication**: Admin, Engineer, and Substation-based logins
- ✅ **Logbook Entry Management**: Create, edit (24h window), delete, and search entries
- ✅ **Rich Text Input**: Context menu for quick insertion (#technicians, @time, /date, &location)
- ✅ **Electrical Parameters**: Track voltage, current, power, frequency, power factor, energy
- ✅ **File Attachments**: Support for images, PDFs, and documents (max 10MB)
- ✅ **Comment System**: Engineers can comment on entries (full thread support)
- ✅ **Email Notifications**: Automatic email alerts to engineers
- ✅ **Advanced Search**: Filter by date, technician, category, severity, text search
- ✅ **Reporting**: Daily/monthly summaries with PDF and Excel export
- ✅ **Database Backup**: Automatic daily backups (2 AM) with 90-day retention

### User Management
- Admin: Full system access
- Engineer: Assigned to one substation, can post and comment
- Technician/Substation: Can post logs and view

### Security
- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Rate limiting
- Session management

## 🚀 Installation

### Prerequisites
- Node.js 16+ and npm 8+
- MySQL 5.7+ or MariaDB 10.3+
- 2GB RAM minimum
- 10GB disk space (for backups and uploads)

### Step 1: Clone/Extract Files
```bash
cd /path/to/your/workspace
# Extract the substation-logbook folder
cd substation-logbook
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```

Edit `.env` file with your settings:
```ini
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=substation_logbook

# Secrets (CHANGE THESE!)
JWT_SECRET=your_secure_random_string_min_32_characters
SESSION_SECRET=another_secure_random_string

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com

# Application
PORT=3000
APP_URL=http://localhost:3000
```

### Step 4: Create Database
```bash
mysql -u root -p
```

```sql
CREATE DATABASE substation_logbook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Import schema:
```bash
mysql -u root -p substation_logbook < database/schema.sql
```

### Step 5: Update Default Admin Password
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YOUR_NEW_PASSWORD', 10).then(hash => console.log(hash));"
```

Copy the hash and update in database:
```sql
USE substation_logbook;
UPDATE users SET password_hash = 'PASTE_HASH_HERE' WHERE username = 'admin';
```

### Step 6: Start Server
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## 📖 Usage

### First Login
1. Open browser: `http://localhost:3000`
2. Login as Admin:
   - Username: `admin`
   - Password: (the password you set in Step 5)

### Admin Tasks

#### Add Substation
1. Navigate to **Substations** menu
2. Click **Add Substation**
3. Fill in details:
   - Substation Code (unique identifier)
   - Name, Location, Voltage Level
   - Password (for substation login)
4. Save

#### Add Engineer
1. Navigate to **Users** menu
2. Click **Add User**
3. Fill in details:
   - Username, Password, Email
   - Role: Engineer
   - Assign to Substation
4. Save

#### Add Technicians
1. Navigate to **Technicians** menu
2. Select substation
3. Add technician details
4. Save

### Engineer/Technician Tasks

#### Post Logbook Entry
1. Click **Post Entry** in sidebar
2. Fill in required fields:
   - Date & Time
   - Severity (Normal/Warning/Critical)
   - Category & Equipment (optional)
   - Select Technicians (checkbox)
   - Message/Description
3. Optional: Add electrical parameters
4. Optional: Attach file
5. Check **Send Email** if engineer should be notified
6. Click **Post Entry**

#### Context Menu in Message
- Type `#` → Select technicians
- Type `@` → Insert time
- Type `/` → Insert date
- Type `&` → Insert location/building

#### Search Logs
1. Click **Search Logs**
2. Set filters:
   - Date range
   - Severity, Category
   - Technician, Text search
3. Click **Search**
4. Export results as PDF or Excel

### Email Configuration

For Gmail (App Password required):
1. Go to https://myaccount.google.com/apppasswords
2. Generate app password
3. Update `.env` or use Admin Settings page
4. Test by posting entry with email notification

For custom SMTP:
1. Admin → Settings → Email Configuration
2. Enter SMTP details
3. Save

## 🗄️ Database Backup

### Automatic Backups
- Runs daily at 2:00 AM (configurable in `.env`)
- Retains last 90 days
- Stored in `/backups` folder

### Manual Backup
1. Admin → Settings → Backup
2. Click **Create Backup Now**
3. Download backup file

### Restore from Backup
```bash
mysql -u root -p substation_logbook < backups/backup-file-name.sql
```

## 📂 Project Structure

```
substation-logbook/
├── server.js              # Main Node.js server
├── package.json           # Dependencies
├── .env                   # Configuration (create from .env.example)
├── database/
│   └── schema.sql         # Database schema
├── public/                # Frontend files
│   ├── index.html         # Login page
│   ├── dashboard.html     # Main dashboard
│   ├── css/
│   │   └── styles.css     # Styles
│   └── js/
│       ├── auth.js        # Authentication
│       ├── app.js         # Main app logic
│       ├── dashboard.js   # Dashboard functions
│       ├── post.js        # Post entry functions
│       └── search.js      # Search functions
├── uploads/               # File uploads (auto-created)
├── backups/               # Database backups (auto-created)
└── config/                # Configuration files
```

## 🔧 Maintenance

### Update Dependencies
```bash
npm update
```

### Check Logs
Server logs are output to console. For production, use PM2:
```bash
npm install -g pm2
pm2 start server.js --name substation-logbook
pm2 logs substation-logbook
```

### Database Optimization
Run monthly:
```sql
USE substation_logbook;
OPTIMIZE TABLE logbook_entries;
OPTIMIZE TABLE comments;
```

## 🛡️ Security Best Practices

1. **Change default admin password immediately**
2. **Use strong JWT_SECRET and SESSION_SECRET**
3. **Enable HTTPS in production**
4. **Set up firewall rules**
5. **Regular backups**
6. **Keep Node.js and dependencies updated**
7. **Use environment variables (never commit .env)**

## 🐛 Troubleshooting

### Database Connection Error
- Check MySQL is running
- Verify credentials in `.env`
- Ensure database exists

### Email Not Sending
- Check SMTP credentials
- For Gmail, use App Password
- Check firewall rules for port 587/465

### File Upload Fails
- Check folder permissions on `uploads/`
- Verify file size < 10MB
- Check allowed file types

### Port Already in Use
```bash
# Change PORT in .env or find process
lsof -i :3000
kill -9 <PID>
```

## 📞 Support

For issues or questions:
- Created by: NAG - SDSC SHAR
- Email: (your email)
- Organization: ISRO - Construction & Maintenance Group

## 📄 License

Internal use only - SDSC SHAR, ISRO

---

**System developed for SDSC SHAR - Construction & Maintenance Group**
"# logbook" 
