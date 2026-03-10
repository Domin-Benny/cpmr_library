# Quick Upload Reference

## 🚀 FileZilla + InfinityFree

### FTP Connection Details:
```
Host: ftpupload.net  (check your InfinityFree panel)
Username: epiz_XXXXXXX
Password: your_ftp_password
Port: 21
```

### Upload Location:
```
Remote Path: /htdocs/
```

---

## ⚠️ CRITICAL: Upload Structure

**DO THIS ✅:**
```
Local: C:\xampp\htdocs\cpmr_library\ALL_FILES → Remote: /htdocs/
```

**NOT THIS ❌:**
```
Local: C:\xampp\htdocs\cpmr_library\ → Remote: /htdocs/cpmr_library/
```

---

## 📦 What to Upload

Select EVERYTHING in `C:\xampp\htdocs\cpmr_library\`:
- ✅ index.html
- ✅ config.js ← NEW! Auto-detects environment
- ✅ All HTML files
- ✅ css/ folder
- ✅ js/ folder  
- ✅ images/ folder
- ✅ backend/ folder
- ✅ database/ folder

---

## 🔧 After Upload

Your site should work at:
```
https://your-domain.infinityfreeapp.com/
```

The `config.js` will automatically detect InfinityFree and adjust all paths!

---

## 🐛 If Something's Wrong

1. **Check browser console** (F12)
2. **Verify files exist** via FileZilla
3. **Clear cache** (Ctrl+Shift+Delete)
4. **Re-upload missing files**

Common issues:
- No CSS? → Re-upload css/ folder
- No images? → Re-upload images/ folder  
- API errors? → Verify backend/ uploaded
- Blank page? → Check index.html in root

---

## ✅ Success Checklist

After upload, verify:
- [ ] Login page loads with styling
- [ ] Logo shows
- [ ] Background displays
- [ ] Can login successfully
- [ ] Dashboard works
- [ ] Data loads

---

**Quick Guide:** See `INFINITYFREE_DEPLOYMENT.md` for full instructions
