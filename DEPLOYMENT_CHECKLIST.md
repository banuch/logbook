# Deployment Checklist

## Pre-Deployment

- [ ] Node.js 16+ installed
- [ ] MySQL 5.7+ or MariaDB 10.3+ installed
- [ ] All dependencies installed (`npm install`)
- [ ] Database created and schema imported
- [ ] `.env` file created from `.env.example`
- [ ] Environment variables configured
- [ ] Admin password changed from default
- [ ] Email SMTP configured (if using notifications)

## Security Checklist

- [ ] Changed `JWT_SECRET` to random 32+ character string
- [ ] Changed `SESSION_SECRET` to random 32+ character string
- [ ] Changed default admin password
- [ ] Database password is strong
- [ ] `.env` file is NOT committed to version control
- [ ] Firewall configured (open port 3000 or configured port)
- [ ] HTTPS enabled (for production)
- [ ] File upload directory has proper permissions
- [ ] Backup directory has proper permissions

## Functional Testing

- [ ] Admin login works
- [ ] Engineer login works  
- [ ] Substation login works
- [ ] Can add substation
- [ ] Can add engineer and assign to substation
- [ ] Can add technicians
- [ ] Can post logbook entry
- [ ] Context menu works (#, @, /, &)
- [ ] File upload works (< 10MB)
- [ ] Email notification works
- [ ] Can search entries
- [ ] Can filter by date/category/severity
- [ ] PDF export works
- [ ] Excel export works
- [ ] Engineer can comment on entries
- [ ] Can edit entry within 24 hours
- [ ] Cannot edit entry after 24 hours
- [ ] Can delete entry within 24 hours
- [ ] Dashboard stats display correctly
- [ ] Recent entries load correctly

## Production Setup

- [ ] PM2 installed and configured
- [ ] Application starts with PM2
- [ ] PM2 configured for auto-start on boot
- [ ] Logs are being written
- [ ] Automatic backup runs at scheduled time (check next day)
- [ ] Manual backup works
- [ ] Old backups are cleaned up (90 day retention)
- [ ] Reverse proxy configured (nginx/apache) if needed
- [ ] SSL certificate installed if using HTTPS
- [ ] Database performance optimized
- [ ] Monitoring set up (optional but recommended)

## Post-Deployment

- [ ] All users can access the system
- [ ] Email notifications are being received
- [ ] Data is being saved correctly
- [ ] Search is working as expected
- [ ] Reports are generating correctly
- [ ] System performance is acceptable
- [ ] Backups are being created
- [ ] Admin has access to all features
- [ ] Engineers have access to their substations only
- [ ] Technicians/Substations can post and view

## Maintenance Schedule

### Daily
- Check application is running (`pm2 status`)
- Verify automatic backup completed

### Weekly  
- Review error logs
- Check disk space (uploads and backups)
- Verify email notifications working

### Monthly
- Test backup restore process
- Optimize database tables
- Review and clean up old uploads if needed
- Update dependencies (`npm update`)
- Security audit

### Quarterly
- Full system backup
- Review user access and permissions
- Performance review and optimization
- Update Node.js if needed

## Emergency Procedures

### Application Down
```bash
pm2 restart substation-logbook
pm2 logs substation-logbook --lines 100
```

### Database Issues
```bash
# Backup current state
mysqldump -u root -p substation_logbook > emergency_backup.sql

# Check database
mysql -u root -p substation_logbook
CHECK TABLE logbook_entries;
REPAIR TABLE logbook_entries;
```

### Restore from Backup
```bash
# Stop application
pm2 stop substation-logbook

# Restore database
mysql -u root -p substation_logbook < backups/backup-file.sql

# Start application
pm2 start substation-logbook
```

## Support Contacts

- Developer: NAG - SDSC SHAR
- Database Admin: [Add contact]
- Network Admin: [Add contact]
- IT Support: [Add contact]

---
Last Updated: 2026-02-08
