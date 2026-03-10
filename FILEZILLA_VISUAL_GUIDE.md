# FileZilla Upload Visual Guide

## 📋 Step-by-Step with Screenshots Description

---

### Step 1: Open FileZilla and Connect

**FileZilla Window Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Host: ftpupload.net  Username: epiz_XXXXXXX        │
│ Password: ********   Port: 21          [Quickconnect]│
└─────────────────────────────────────────────────────┘

After connecting, you'll see:
┌──────────────────────┬───────────────────────┐
│  Local Site          │   Remote Site         │
│  (Your Computer)     │   (InfinityFree)      │
│                      │                       │
│  C:\xampp\htdocs\    │   /                   │
│  └── cpmr_library/   │   └── htdocs/         │
└──────────────────────┴───────────────────────┘
```

---

### Step 2: Navigate to Your Files

**LEFT SIDE (Local):**
```
Navigate to:
C:\xampp\htdocs\cpmr_library\

You should see:
📁 index.html
📁 config.js          ← NEW FILE!
📁 feedback.html
📁 preview_profile.html
📁 css/
📁 js/
📁 images/
📁 backend/
📁 database/
```

**RIGHT SIDE (Remote):**
```
Navigate to:
/htdocs/

This is where files will go!
```

---

### Step 3: Select ALL Files

**On LEFT side:**
1. Click anywhere in the file list
2. Press `Ctrl + A` (Select All)
3. You should see ALL files highlighted/folder name turns blue

✅ Selected:
- index.html
- config.js
- feedback.html
- preview_profile.html
- service-worker.js
- css/ folder
- js/ folder
- images/ folder
- backend/ folder
- database/ folder
- All other files

---

### Step 4: Upload to Correct Location

**CRITICAL - Where to Upload:**

✅ **CORRECT:**
```
Remote Path: /htdocs/
              ↑
Files go DIRECTLY here!
```

❌ **WRONG:**
```
/htdocs/cpmr_library/  ← Don't create this folder!
```

**How to Upload:**
1. Make sure RIGHT side shows `/htdocs/`
2. Drag selected files from LEFT to RIGHT
3. Or Right-click → Upload

---

### Step 5: Watch the Transfer

**Bottom Panel (Transfer Queue):**
```
┌──────────────────────────────────────────────┐
│ Status: Transferring...                      │
│                                              │
│ index.html           101 KB   Successful ✓   │
│ config.js            1.2 KB   Successful ✓   │
│ style.css            91 KB    Successful ✓   │
│ script.js            584 KB   In progress... │
│ ...                  ...      Waiting        │
└──────────────────────────────────────────────┘
```

Wait until ALL files show "Successful" ✓

---

### Step 6: Verify Upload Structure

**After upload, Remote Site (/htdocs/) should show:**

```
/htdocs/
├── 📄 index.html
├── 📄 config.js
├── 📄 feedback.html
├── 📄 preview_profile.html
├── 📄 service-worker.js
├── 📁 css/
│   ├── style.css
│   ├── modern-design.css
│   └── dashboard-redesign.css
├── 📁 js/
│   ├── script.js
│   ├── book-edit-new.js
│   ├── book-inline-edit.js
│   └── simple-book-edit.js
├── 📁 images/
│   ├── logos/
│   ├── login-backgrounds/
│   └── profile_pictures/
└── 📁 backend/
    ├── api/
    ├── config/
    ├── includes/
    └── uploads/
```

---

## 🔍 Common Mistakes Visual Guide

### ❌ MISTAKE 1: Wrong Folder Structure

```
WRONG:
/htdocs/
└── cpmr_library/      ← Don't upload folder itself!
    ├── index.html
    └── css/

Result: Your site will be at:
https://yoursite.infinityfreeapp.com/cpmr_library/
(Broken paths!)
```

### ✅ CORRECT: Direct Upload

```
CORRECT:
/htdocs/
├── index.html         ← Files directly in htdocs
├── css/
└── js/

Result: Your site will be at:
https://yoursite.infinityfreeapp.com/
(Perfect!)
```

---

### ❌ MISTAKE 2: Missing config.js

If you forget config.js:
```
/htdocs/
├── index.html
└── (no config.js!)    ← Missing!

Result: 
- Site won't load properly
- API calls will fail
- Paths won't work on InfinityFree
```

### ✅ CORRECT: Include Everything

```
/htdocs/
├── index.html
├── config.js          ← Must be here!
└── all other files

Result: Everything works!
```

---

## 🎯 Testing After Upload

### Test 1: Access Your Site

Open browser and go to:
```
https://your-username.infinityfreeapp.com/
```

### Test 2: Check Login Page

What you should see:
```
┌─────────────────────────────────────┐
│  [CPMR Logo]                        │
│                                     │
│  CPMR Library System                │
│  Centre for Plant Medicine Research │
│                                     │
│  [Admin Dashboard] [Librarian] etc │
│                                     │
└─────────────────────────────────────┘
```

✅ If you see this with proper styling = SUCCESS!

### Test 3: Browser Console Check

Press F12, go to Console tab:

✅ **Good Console:**
```
Environment detected: {isProduction: true, hostname: "..."}
All resources loaded successfully
```

❌ **Bad Console (Problems):**
```
Failed to load resource: css/style.css - 404 Not Found
config.js not found
API_BASE_URL undefined
```

---

## 🐛 Troubleshooting Visual Guide

### Problem: No Styling

**What you see:**
```
Plain text page, no colors, no formatting
```

**Cause:** CSS files missing or wrong path

**Fix:**
1. Check in FileZilla if css/ folder exists
2. Verify files inside:
   ```
   /htdocs/css/style.css ✓
   /htdocs/css/modern-design.css ✓
   ```
3. Re-upload css/ folder if missing

---

### Problem: Broken Images

**What you see:**
```
[Image icon with broken corner]
```

**Cause:** Images folder not uploaded

**Fix:**
1. Verify in FileZilla:
   ```
   /htdocs/images/logos/cpmrlogo.jpeg.jfif
   /htdocs/images/login-backgrounds/cpmr.jpeg.jpeg
   ```
2. Re-upload entire images/ folder

---

### Problem: Blank White Page

**What you see:**
```
Completely blank, nothing loads
```

**Cause:** index.html missing or config.js missing

**Fix:**
1. Check if index.html exists in /htdocs/
2. Check if config.js exists in /htdocs/
3. View page source (Ctrl+U) - should see HTML
4. Re-upload both files if missing

---

## ✅ Success Indicators

### Perfect Upload Checklist:

✓ Login page loads with full styling  
✓ CPMR logo displays at top  
✓ Background image shows  
✓ All buttons visible and styled  
✓ Can click and navigate  
✓ Forms work properly  
✓ No errors in console (F12)  

---

## 📊 File Size Reference

Typical upload sizes:
```
index.html           ~101 KB
config.js            ~1 KB
css/style.css        ~91 KB
js/script.js         ~584 KB
images/ folder       ~2-3 MB (largest part)
backend/ folder      ~500 KB
database/ folder     ~200 KB

Total: ~3-4 MB
Time: 5-15 minutes (depends on internet speed)
```

---

## 🚀 Quick Tips

1. **Upload in one go:** Select ALL files at once
2. **Use queue:** FileZilla handles multiple files automatically
3. **Check transfer log:** Bottom panel shows failures
4. **Don't close FileZilla:** Wait until all transfers complete
5. **Verify after upload:** Browse folders in Remote panel

---

**Need more details?** See `INFINITYFREE_DEPLOYMENT.md` for complete guide
