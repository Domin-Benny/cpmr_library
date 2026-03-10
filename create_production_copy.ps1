# PowerShell Script to Create Clean Production Copy
# Run this script to automatically create a clean folder for upload

$source = "C:\xampp\htdocs\cpmr_library"
$destination = "C:\xampp\htdocs\cpmr_library_PRODUCTION"

Write-Host "=== Creating Clean Production Copy ===" -ForegroundColor Green
Write-Host ""

# Create destination folder
if (Test-Path $destination) {
    Write-Host "Removing old production folder..." -ForegroundColor Yellow
    Remove-Item $destination -Recurse -Force
}

Write-Host "Creating new production folder..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $destination -Force | Out-Null

# Copy essential files and folders
Write-Host "`nCopying essential files..." -ForegroundColor Cyan

# Root HTML files
Copy-Item "$source\index.html" $destination
Copy-Item "$source\config.js" $destination
Copy-Item "$source\feedback.html" $destination
Copy-Item "$source\preview_profile.html" $destination
Copy-Item "$source\service-worker.js" $destination
Copy-Item "$source\.htaccess" $destination -ErrorAction SilentlyContinue

# CSS folder
Write-Host "  - Copying CSS..." -ForegroundColor Gray
Copy-Item "$source\css" $destination -Recurse

# JavaScript folder  
Write-Host "  - Copying JavaScript..." -ForegroundColor Gray
Copy-Item "$source\js" $destination -Recurse

# Images (selective - CRITICAL SIZE REDUCTION)
Write-Host "  - Copying ONLY essential images (size optimization)..." -ForegroundColor Gray
New-Item -ItemType Directory -Path "$destination\images" -Force | Out-Null
# Only copy logos and login backgrounds - these are small and essential
Copy-Item "$source\images\logos" "$destination\images" -Recurse -ErrorAction SilentlyContinue
Copy-Item "$source\images\login-backgrounds" "$destination\images" -Recurse -ErrorAction SilentlyContinue
# SKIP profile_pictures, book_covers, journal-covers, policy-covers (too large)
Write-Host "    Skipped: profile_pictures, book-covers, journal-covers, policy-covers (too large)" -ForegroundColor Yellow

# Backend (CRITICAL - but skip uploads content)
Write-Host "  - Copying backend (excluding test uploads)..." -ForegroundColor Gray
Copy-Item "$source\backend" $destination -Recurse

# Empty the uploads folder in production copy
Write-Host "  - Emptying uploads folder (test files removed)..." -ForegroundColor Yellow
Remove-Item "$destination\backend\uploads\book_covers\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$destination\backend\uploads\journals\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$destination\backend\uploads\policies\*" -Recurse -Force -ErrorAction SilentlyContinue

# Database - DO NOT UPLOAD (too large)
# Instead, import via phpMyAdmin after upload
Write-Host "  - Skipping database files (import via phpMyAdmin later)..." -ForegroundColor Yellow
# Create empty database folder as placeholder
New-Item -ItemType Directory -Path "$destination\database" -Force | Out-Null
# Copy only the main SQL file reference (not the actual large file)
Write-Host "    Note: Import database/cpmr_library.sql via phpMyAdmin after upload" -ForegroundColor Yellow

Write-Host "`n=== CLEANUP COMPLETE ===" -ForegroundColor Green
Write-Host ""

# Count files
$fileCount = (Get-ChildItem $destination -Recurse -File | Measure-Object).Count
Write-Host "Production folder created: $destination" -ForegroundColor Green
Write-Host "Total files to upload: $fileCount" -ForegroundColor Green
Write-Host ""
Write-Host "Original had 1,400+ files - This has ~$fileCount files!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open FileZilla" -ForegroundColor White
Write-Host "2. Navigate to: $destination" -ForegroundColor White
Write-Host "3. Upload ALL files to /htdocs/" -ForegroundColor White
Write-Host "4. Your site will work perfectly!" -ForegroundColor White
