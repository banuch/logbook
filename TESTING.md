# Testing Guide - New Features

Quick testing checklist for all newly implemented features.

---

## 🧪 **Testing Checklist**

### **1. Technicians Management Page**

**Access:** Dashboard → Technicians (Admin/Engineer only)

- [ ] **Load Page**
  - Page loads without errors
  - Substation dropdown is populated
  - Table shows "Select a substation" message

- [ ] **Filter by Substation**
  - Select a substation from dropdown
  - Table loads technicians for that substation
  - No technicians shows appropriate message

- [ ] **Add Technician**
  - Click "➕ Add Technician" button
  - Modal opens with form
  - All fields are editable
  - Required fields are marked with *
  - Form validation works (try submitting empty)
  - Save creates new technician
  - Table refreshes with new entry

- [ ] **Edit Technician**
  - Click ✏️ edit button on a technician
  - Modal opens with pre-filled data
  - Employee ID cannot be changed
  - Save updates the technician
  - Table refreshes with updated data

- [ ] **Delete Technician**
  - Click 🗑️ delete button
  - Confirmation dialog appears
  - Confirm deletes the technician
  - Table refreshes without deleted entry

- [ ] **Engineer Restrictions**
  - Login as engineer
  - Can only see their assigned substation
  - Dropdown is disabled
  - Can only manage their substation's technicians

---

### **2. Substations Management Page**

**Access:** Dashboard → Substations (Admin only)

- [ ] **Load Page**
  - Page loads with all substations
  - Table shows code, name, location, voltage, capacity, status
  - Admin-only access enforced

- [ ] **Add Substation**
  - Click "➕ Add Substation" button
  - Modal opens with form grid layout
  - All fields editable
  - Password is required for new substation
  - Form validation works
  - Save creates new substation
  - Table refreshes

- [ ] **Edit Substation**
  - Click ✏️ edit button
  - Modal opens with pre-filled data
  - Substation code is disabled (cannot change)
  - Password is optional (blank = keep existing)
  - Save updates the substation
  - Table refreshes

- [ ] **Toggle Status**
  - Click 🔒/🔓 button
  - Confirmation dialog appears
  - Confirm toggles active/inactive status
  - Badge color changes (green/red)
  - Table refreshes

---

### **3. Users Management Page**

**Access:** Dashboard → Users (Admin only)

- [ ] **Load Page**
  - Page loads with all users
  - Table shows username, name, email, role, substation, status, last login
  - Admin-only access enforced

- [ ] **Add User - Admin**
  - Click "➕ Add User" button
  - Select role = "admin"
  - Substation field stays hidden
  - Password requirements display when typing
  - Password must match confirmation
  - All 4 requirements turn green
  - Save creates admin user

- [ ] **Add User - Engineer**
  - Click "➕ Add User" button
  - Select role = "engineer"
  - Substation field becomes visible and required
  - Password validation works
  - Save creates engineer with assigned substation

- [ ] **Password Validation UI**
  - Start typing password
  - Requirements list appears
  - ✗ shows in red for unmet requirements
  - ✓ shows in green for met requirements
  - Test each requirement:
    - Type 7 chars → length stays red
    - Type 8 chars → length turns green
    - Add uppercase → uppercase turns green
    - Add lowercase → lowercase turns green
    - Add number → number turns green

- [ ] **Edit User**
  - Click ✏️ edit button
  - Username is disabled (cannot change)
  - Password is optional (blank = keep existing)
  - Can change role and substation
  - Save updates user

- [ ] **Toggle User Status**
  - Click 🔒/🔓 button
  - Confirmation appears
  - Status toggles
  - Badge updates

---

### **4. Settings Page**

**Access:** Dashboard → Settings (Admin only)

#### **Email Configuration**

- [ ] **Load Email Config**
  - Existing config loads automatically
  - Password field is empty (security)
  - All other fields are populated

- [ ] **Save Email Config**
  - Fill all required fields
  - SMTP host (e.g., smtp.gmail.com)
  - SMTP port (587 or 465)
  - Email and password
  - Click save
  - Success message appears
  - Config is saved

#### **Equipment Types**

- [ ] **View Equipment**
  - 12 default equipment types load
  - Displayed as tags with delete buttons

- [ ] **Add Equipment**
  - Click "➕ Add Equipment"
  - Modal opens
  - Enter name and description
  - Save adds new equipment tag
  - List refreshes

- [ ] **Delete Equipment**
  - Click × on a tag
  - Confirmation appears
  - Confirm removes the tag
  - List refreshes

#### **Event Categories**

- [ ] **View Categories**
  - 10 default categories load
  - Displayed as tags with delete buttons

- [ ] **Add Category**
  - Click "➕ Add Category"
  - Modal opens
  - Enter name and description
  - Save adds new category tag
  - List refreshes

- [ ] **Delete Category**
  - Click × on a tag
  - Confirmation appears
  - Confirm removes the tag
  - List refreshes

#### **Database Backup**

- [ ] **View Backup History**
  - Table loads with all backups
  - Shows filename, date, size, type, status
  - Download links work for successful backups

- [ ] **Create Manual Backup**
  - Click "🔄 Create Backup Now"
  - Confirmation appears
  - "Creating backup..." message shows
  - Backup creates (may take few seconds)
  - Success message with size
  - Table refreshes with new backup

- [ ] **Download Backup**
  - Click "📥 Download" on a backup
  - File downloads to computer
  - File is a valid .sql file

---

### **5. Reports Page**

**Access:** Dashboard → Reports

#### **Daily Summary**

- [ ] **Load Page**
  - Date defaults to today
  - Substation dropdown populated
  - "All Substations" option available

- [ ] **Generate Daily Report**
  - Select a date
  - Optionally select substation
  - Click "Generate Report"
  - Report displays with:
    - Total entries count
    - Normal/Warning/Critical counts
    - Category breakdown table

- [ ] **Engineer View**
  - Login as engineer
  - Substation is pre-selected and locked
  - Can only generate reports for their substation

#### **Monthly Summary**

- [ ] **Load Page**
  - Month dropdown populated (Jan-Dec)
  - Year dropdown populated (current - 5 years)
  - Substation dropdown populated

- [ ] **Generate Monthly Report**
  - Select month and year
  - Optionally select substation
  - Click "Generate Report"
  - Report displays with:
    - Total entries
    - Severity breakdown
    - Active days count
    - Category breakdown

---

### **6. Context Menu in Message Field**

**Access:** Dashboard → Post Entry → Message field

- [ ] **Technician Insert (#)**
  - Click in message field
  - Type `#`
  - Dropdown appears with selected technicians
  - Click a technician name
  - Name is inserted, `#` is replaced
  - Cursor moves to end of inserted text

- [ ] **Time Insert (@)**
  - Type `@` in message field
  - Dropdown appears with:
    - Current time in 24-hour format
    - Current time in 12-hour format
  - Click a time
  - Time is inserted, `@` is replaced

- [ ] **Date Insert (/)**
  - Type `/` in message field
  - Dropdown appears with:
    - DD/MM/YYYY format
    - ISO format (YYYY-MM-DD)
    - Locale format
  - Click a date
  - Date is inserted, `/` is replaced

- [ ] **Location Insert (&)**
  - Type `&` in message field
  - Dropdown appears with:
    - Main Building
    - Control Room
    - Switch Yard
    - Transformer Bay
  - Click a location
  - Location is inserted, `&` is replaced

- [ ] **Context Menu Behavior**
  - Click outside menu → menu closes
  - Type normal text → menu stays hidden
  - Menu positions below textarea
  - No conflicts with normal typing

---

### **7. Integration Testing**

- [ ] **Cross-Page Navigation**
  - Navigate between all pages
  - No errors in console
  - Pages load correctly
  - Data persists correctly

- [ ] **Role-Based Access**
  - Admin sees all menu items
  - Engineer sees limited menu items
  - Technician/Substation sees basic menu items
  - Admin-only pages blocked for non-admin

- [ ] **Data Flow**
  - Create substation → appears in user assignment dropdown
  - Create technician → appears in post entry checkboxes
  - Create equipment → appears in post entry dropdown
  - Create category → appears in post entry dropdown
  - Changes reflect immediately across pages

- [ ] **Form Validation**
  - All required fields enforced
  - Email validation works
  - Phone validation works
  - Password validation works
  - Appropriate error messages shown

- [ ] **Success/Error Handling**
  - Success messages show for successful operations
  - Error messages show for failures
  - Messages auto-hide after 5 seconds
  - No operations leave pages in broken state

---

### **8. Browser Testing**

Test in each browser:

- [ ] **Chrome** - All features work
- [ ] **Firefox** - All features work
- [ ] **Edge** - All features work
- [ ] **Safari** (if available) - All features work

---

### **9. Responsive Testing**

- [ ] **Desktop** (1920x1080)
  - All pages display correctly
  - Tables don't overflow
  - Forms are well-spaced

- [ ] **Tablet** (768x1024)
  - Sidebar collapses/works correctly
  - Tables are scrollable
  - Forms stack vertically

- [ ] **Mobile** (375x667)
  - All content accessible
  - Buttons are tappable
  - Text is readable
  - Forms are usable

---

### **10. Performance Testing**

- [ ] **Page Load Times**
  - Dashboard loads in < 2 seconds
  - All pages load in < 3 seconds
  - Large tables paginate correctly

- [ ] **Data Operations**
  - Creating records < 1 second
  - Updating records < 1 second
  - Deleting records < 1 second
  - Report generation < 3 seconds

---

## ✅ **Test Sign-off**

**Tester Name:** ___________________  
**Date:** ___________________  
**Version Tested:** 1.0.0  
**Overall Status:** [ ] Pass [ ] Fail  

**Notes:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## 🐛 **Bug Report Template**

**Page:** ___________________  
**Feature:** ___________________  
**Steps to Reproduce:**
1. ___________________
2. ___________________
3. ___________________

**Expected Result:** ___________________  
**Actual Result:** ___________________  
**Browser:** ___________________  
**Screenshot:** (attach if available)

---

**Happy Testing! 🧪**
