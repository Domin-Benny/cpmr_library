# InfinityFree Upload Troubleshooting Checklist

## 🔍 Step 1: Check FileZilla Error Messages

Open FileZilla and look at the **Message Log** (top panel) or **Failed Transfers** (bottom panel).

What error do you see?

---

### ❌ Error: "Disk quota exceeded" or "No space left on device"

**Meaning:** You've hit InfinityFree's storage limit

**Your Current Situation:**
```
Estimated file count: ~500+ files
- Core application: ~150 files
- Documentation: ~20 MD files
- Test uploads: ~98 files (book covers, journals, policies)
- Other: ~30+ files
```

**Fix:**
1. **DON'T upload these folders:**
   ```
   ❌ docs/                    ← Skip entirely
   ❌ *.md files               ← Just documentation
   ❌ backend/uploads/*        ← Delete test files inside
   ```

2. **Clean up before upload:**
   ```powershell
   # Run this in PowerShell to see actual app size without uploads
   Get-ChildItem "C:\xampp\htdocs\cpmr_library" -Recurse -Exclude book_covers,journals,policies | 
   Measure-Object -Property Length -Sum | 
   Select-Object Count, @{Name="Size(MB)";Expression={[math]::Round($_.Sum/1MB,2)}}
   ```

3. **Upload only essentials** (see WHAT_NOT_TO_UPLOAD.md)

---

### ❌ Error: "Connection timed out" or "Timeout after X seconds"

**Meaning:** Upload taking too long, connection dropped

**Why:** Too many files uploading at once

**Fix:**

**Option A: Increase Timeout**
1. In FileZilla: Edit → Settings
2. Go to "Connection"
3. Change "Timeout in seconds" from 20 to **60**
4. Try again

**Option B: Upload in Batches**
```
Batch 1 (Priority 1):
✅ index.html
✅ config.js
✅ css/
✅ js/
✅ backend/api/
✅ backend/config/
✅ backend/includes/

Batch 2 (Priority 2):
✅ feedback.html
✅ preview_profile.html
✅ service-worker.js
✅ images/logos/
✅ images/login-backgrounds/

Batch 3 (If needed later):
✅ backend/scripts/
✅ database/
```

**Option C: Drag Drop Smaller Groups**
- Don't select all files at once
- Select 10-20 files
- Upload those
- Repeat

---

### ❌ Error: "Permission denied" or "Access denied"

**Meaning:** InfinityFree won't let you create that file/folder

**Common causes:**
1. Trying to upload to wrong directory
2. File permissions issue
3. Hidden system files

**Fix:**

1. **Verify you're uploading to correct location:**
   ```
   Remote path should be: /htdocs/
   NOT: /htdocs/cpmr_library/
   ```

2. **Check file permissions locally:**
   - Right-click problematic file → Properties
   - Make sure it's not "Read-only"

3. **Set correct permissions after upload:**
   - In FileZilla, right-click uploaded file
   - File permissions → Set to 644
   - For folders → Set to 755

---

### ❌ Error: "File size exceeds server limit"

**Meaning:** Individual file is > 10MB (InfinityFree limit)

**Check which files are too big:**
```powershell
# Run this to find large files
Get-ChildItem "C:\xampp\htdocs\cpmr_library" -Recurse -File | 
Where-Object { $_.Length -gt 5MB } | 
Select-Object Name, @{Name="Size(MB)";Expression={[math]::Round($_.Length/1MB,2)}}, DirectoryName |
Sort-Object Length -Descending
```

**Likely culprits:**
- Large images in uploads/book_covers/
- Database backup files
- Log files

**Fix:**
1. Don't upload files > 5MB
2. Compress images first
3. Upload database via phpMyAdmin import instead of file upload

---

### ❌ Error: "Too many open files" or "Resource temporarily unavailable"

**Meaning:** InfinityFree limiting concurrent connections

**Why:** FileZilla trying to upload too many files simultaneously

**Fix:**

1. **Limit simultaneous transfers:**
   - Edit → Settings → Transfers
   - Change "Maximum simultaneous transfers" from 10 to **2** or **1**
   - Slower but more reliable

2. **Upload folder by folder instead of all at once**

---

### ❌ Error: "Remote directory does not exist"

**Meaning:** You're trying to upload to a folder that doesn't exist

**Common mistake:**
```
❌ Trying to create: /htdocs/cpmr_library/
✅ Should upload to: /htdocs/
```

**Fix:**
1. In FileZilla remote panel (right side), navigate to `/htdocs/`
2. Make sure you're NOT inside a `cpmr_library` subfolder
3. Upload files directly to `/htdocs/`

---

## 🎯 Quick Diagnostic Steps

### Step 1: Check Your Total Files
Run this PowerShell command:
```powershell
Get-ChildItem "C:\xampp\htdocs\cpmr_library\backend\uploads" -Recurse -File | 
Measure-Object | 
Select-Object Count
```

If count is > 50, **this is your problem!**

### Step 2: Clean Uploads Folder
```powershell
# Delete test uploads (they'll be recreated when users upload)
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\book_covers\*" -Recurse -Force
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\journals\*" -Recurse -Force  
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\policies\*" -Recurse -Force
```

### Step 3: Verify What to Upload
See: [`WHAT_NOT_TO_UPLOAD.md`](file:///c:/xampp/htdocs/cpmr_library/WHAT_NOT_TO_UPLOAD.md)

---

## ✅ Recommended Upload Strategy

### Phase 1: Prepare Clean Version

1. **Create production copy:**
   ```
   Copy entire folder to: C:\xampp\htdocs\cpmr_library_clean\
   ```

2. **Delete unnecessary files from clean copy:**
   ```
   ❌ Delete: docs/
   ❌ Delete: *.md files (except DEPLOYMENT guides)
   ❌ Delete: backend/uploads/* contents (keep folders)
   ❌ Delete: .vscode/
   ❌ Delete: .qoder/
   ❌ Delete: composer.json, composer.lock
   ❌ Delete: package.json, package-lock.json
   ```

3. **Result:** ~150-200 essential files instead of 500+

### Phase 2: Upload Clean Version

1. Open FileZilla
2. Navigate to `cpmr_library_clean`
3. Select ALL files (Ctrl+A)
4. Upload to `/htdocs/`
5. Should complete much faster!

---

## 📊 File Size Reference

**Typical essential files size:**
```
index.html           101 KB
config.js            1 KB
css/style.css        91 KB
js/script.js         584 KB
backend/             ~500 KB (without uploads)
images/              ~2 MB (logos + backgrounds only)

Total essential:     ~3-4 MB
With test uploads:   ~10+ MB ❌
```

---

## 🚨 Most Common Issue: TEST UPLOADS FOLDER

**The #1 reason uploads fail:**

You have test files in `backend/uploads/`:
```
book_covers/     ← 81 files uploaded during testing
journals/        ← 14 files uploaded during testing
policies/        ← 3 files uploaded during testing
```

**These should NOT be uploaded!** They're created dynamically when users upload content.

**Before uploading, delete contents:**
```powershell
# Run these commands
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\book_covers\*" -Recurse
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\journals\*" -Recurse
Remove-Item "C:\xampp\htdocs\cpmr_library\backend\uploads\policies\*" -Recurse

# Keep the folders, just empty them
```

---

## 💬 Tell Me Your Error

Check FileZilla and tell me:

1. **What's the exact error message?**
2. **Which file fails first?**
3. **How many files total are you trying to upload?**

Then I can give you the exact fix!
