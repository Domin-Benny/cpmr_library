# What NOT to Upload to InfinityFree

## ❌ DON'T Upload These Folders/Files:

### 1. Documentation Folder (Skip Entirely)
```
❌ docs/                    ← 16 MD files, not needed online
❌ *.md files in root       ← Just documentation
```

### 2. Test/Debug Files (Already Removed, but verify)
```
❌ Any remaining test_*.html
❌ Any remaining debug_*.php
❌ *.log files
```

### 3. Backup Files
```
❌ *.backup
❌ *.bak  
❌ *.tmp
❌ *.old
```

### 4. Development Files
```
❌ .vscode/                 ← Editor settings
❌ .qoder/                  ← AI assistant files
❌ composer.json            ← PHP dependency management (not needed)
❌ composer.lock            ← PHP dependencies
❌ package.json             ← Node.js config (not used)
❌ package-lock.json        ← Node dependencies
```

### 5. Database Source Files (Keep Only SQL)
```
❌ database/migrations/     ← Intermediate migrations
❌ database/*.php           ← Migration scripts
✅ KEEP: database/*.sql     ← Actual database structure
```

### 6. Excessive Uploaded Files (CRITICAL!)
```
backend/uploads/book_covers/    ← 81 files!
backend/uploads/journals/       ← 14 files!
backend/uploads/policies/       ← 3 files!
```

**Problem:** These are USER-UPLOADED files that were created during testing.
**Solution:** Don't upload these - they'll be created when users upload content!

---

## ✅ DO Upload - Essential Files Only:

### Root Level:
```
✅ index.html
✅ config.js               ← CRITICAL!
✅ feedback.html
✅ preview_profile.html
✅ service-worker.js
✅ .htaccess              ← Apache configuration
✅ .gitignore             ← Git ignore (optional)
```

### CSS Folder (ALL):
```
✅ css/style.css
✅ css/modern-design.css
✅ css/dashboard-redesign.css
```

### JavaScript Folder (ALL):
```
✅ js/script.js
✅ js/book-edit-new.js
✅ js/book-inline-edit.js
✅ js/simple-book-edit.js
```

### Images Folder (SELECTIVE):

#### Upload These:
```
✅ images/logos/cpmrlogo.jpeg.jfif
✅ images/login-backgrounds/*.jpeg
✅ images/profile_pictures/default.jpg (if exists)
```

#### Optional (Reduce Size):
```
⚠️ images/book-covers/     ← Only if you pre-loaded books
⚠️ images/journal-covers/  ← Only if pre-loaded journals
⚠️ images/policy-covers/   ← Only if pre-loaded policies
```

### Backend Folder (ALL - This is ESSENTIAL):
```
✅ backend/api/            ← All 38 API endpoints
✅ backend/config/         ← Database configuration
✅ backend/includes/       ← Helper functions
✅ backend/scripts/        ← Migration scripts
✅ backend/uploads/        ← UPLOAD EMPTY FOLDER!
```

**Important:** The `backend/uploads/` folder should be **EMPTY** or contain only a few sample files. User uploads will go here later!

### Database Folder (SQL ONLY):
```
✅ database/cpmr_library.sql      ← Main database
✅ database/*.sql                 ← Important setup scripts
❌ database/*.php                 ← Skip migration PHP scripts
```

---

## 📊 File Count Comparison:

### Before Optimization:
```
Total files: ~500+
- docs/: 16 files
- *.md: 20+ files
- uploads/: 98 files (book covers, journals, etc.)
- development: 10+ files
- tests: Already removed ✓
```

### After Optimization:
```
Essential files: ~150-200
- Much faster upload
- Less chance of timeout
- Cleaner deployment
```

---

## 🎯 Optimized Upload Strategy:

### Step 1: Create Clean Copy
```
1. Create new folder: C:\xampp\htdocs\cpmr_library_production\
2. Copy ONLY essential files listed above
3. Leave out everything in "DON'T Upload" section
```

### Step 2: Upload Clean Version
```
1. Open FileZilla
2. Navigate to clean folder
3. Select ALL files
4. Upload to /htdocs/
5. Should complete much faster!
```

---

## ⚡ Quick Fix - Skip Problem Folders:

If upload fails, try uploading in this order:

### Phase 1: Core Files (Required)
```
✅ index.html
✅ config.js
✅ feedback.html
✅ preview_profile.html
✅ service-worker.js
✅ css/ folder
✅ js/ folder
✅ backend/ folder (EXCEPT uploads/)
```

### Phase 2: Assets (If Space Allows)
```
✅ images/logos/
✅ images/login-backgrounds/
⚠️ images/profile_pictures/ (selective)
```

### Phase 3: Skip These (Not Critical)
```
❌ backend/uploads/book_covers/    ← User will upload
❌ backend/uploads/journals/       ← User will upload  
❌ backend/uploads/policies/       ← User will upload
❌ docs/
❌ *.md files
```

---

## 🔍 How to Identify Upload Failures:

### In FileZilla:
1. Look at **Failed Transfers** tab (bottom)
2. Check error messages:
   - **"Disk quota exceeded"** → Too many files or over storage limit
   - **"Connection timed out"** → Too many files, upload in batches
   - **"Permission denied"** → File/folder permissions issue
   - **"File size exceeds limit"** → Individual file > 10MB

### Fix Based on Error:

**"Disk quota exceeded":**
- Remove non-essential files
- Delete test uploads from backend/uploads/
- Reduce image quality/size

**"Connection timed out":**
- Upload in smaller batches
- Increase timeout in FileZilla (Edit → Settings → Connection)
- Upload during off-peak hours

**"Permission denied":**
- Right-click file → File permissions → Set to 644
- For folders → Set to 755

---

## 💡 Pro Tips:

### 1. Empty Uploads Folder
Before uploading:
```
Delete contents of: backend/uploads/book_covers/
Delete contents of: backend/uploads/journals/
Delete contents of: backend/uploads/policies/

Keep folders empty or with just 1-2 sample files
```

Why? These are created dynamically when users upload content!

### 2. Compress Images
Large images slow down upload:
```
Optimize images in images/ folder
Use tools like TinyPNG.com
Target: < 500KB per image
```

### 3. Batch Upload
Don't upload everything at once:
```
Batch 1: Core files (HTML, CSS, JS, backend)
Batch 2: Images (if separate)
Batch 3: Database (if needed)
```

---

## ✅ Minimal Viable Upload:

If you're still having issues, upload ONLY this:

```
✅ index.html
✅ config.js
✅ feedback.html
✅ preview_profile.html
✅ css/ (all 3 files)
✅ js/ (all 4 files)
✅ backend/ (all EXCEPT uploads/ contents)
✅ images/logos/
✅ images/login-backgrounds/
```

**Skip temporarily:**
```
⏸️ backend/uploads/ (except empty folder structure)
⏸️ docs/
⏸️ *.md files
⏸️ database/ (import via phpMyAdmin instead)
```

This gets your site running immediately, then you can add optional files later!

---

**Next Step:** Check FileZilla's failed transfers list and let me know which error you're getting!
