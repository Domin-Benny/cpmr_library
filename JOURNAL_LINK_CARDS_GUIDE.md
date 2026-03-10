# Journal Link Cards Feature Documentation

## Overview
The Journal Link Cards feature allows users to upload clickable link cards that open external websites directly, without requiring a PDF file. These link cards appear alongside PDF journals in the same journals section, using the same upload interface.

## Features

### ✨ Key Benefits
- **No Separate Button**: Link upload is integrated into the existing journal upload modal
- **Same Workflow**: Uses the same upload process as PDF journals
- **Visual Distinction**: Link cards have a unique purple gradient design vs PDF journal covers
- **Click to Open**: Clicking a link card opens the external website in a new tab
- **No PDF Required**: Users can share useful links without uploading files
- **Admin Control**: Admins and Librarians can delete link cards

## How It Works

### For Users

#### Uploading a Link Card
1. Click the **"📤 Upload Journal (PDF)"** button (same button as PDF uploads)
2. In the modal, select **"External Link Card"** from the dropdown
3. Fill in the form:
   - **Link Title***: Name of the link (e.g., "Research Gate Profile")
   - **Website URL***: Full URL (e.g., `https://researchgate.net/profile/...`)
   - **Description** (optional): Brief description of what the link contains
4. Click **"Upload"** to create the link card

#### Uploading a PDF Journal
1. Click the **"📤 Upload Journal (PDF)"** button
2. Ensure **"PDF Journal"** is selected in the dropdown (default)
3. Fill in the traditional PDF upload form
4. Click **"Upload"**

#### Viewing Link Cards
- Link cards appear **first** in the journals grid with a **purple gradient** background
- PDF journals appear **after** link cards with the standard **journal cover** image
- Link cards show a **🔗 link icon** in the top-right corner
- Click anywhere on the link card or the **"🌐 Visit Website"** button to open the link

### For Administrators/Librarians

#### Deleting Link Cards
- Admin and Librarian roles see a **"🗑️ Delete Link"** button on link cards
- Clicking delete shows a confirmation dialog
- Deleted links cannot be recovered

## Technical Implementation

### Database Changes
**New Table**: `journal_links`
```sql
CREATE TABLE journal_links (
    link_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    uploaded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(user_id) ON DELETE SET NULL
);
```

### API Endpoints

#### Add Link
```
POST /backend/api/journals.php?action=add_link
Headers: Authorization: Bearer {token}
Body: {
    "name": "Link Title",
    "url": "https://example.com",
    "description": "Optional description"
}
```

#### Get Links
```
GET /backend/api/journals.php?action=get_links
Headers: Authorization: Bearer {token}
```

#### Delete Link
```
DELETE /backend/api/journals.php?action=delete_link&id={link_id}
Headers: Authorization: Bearer {token}
Role: Admin or Librarian
```

### Modified Files

1. **index.html**
   - Updated upload modal to include type selector
   - Added separate forms for PDF and link uploads

2. **js/script.js**
   - `toggleJournalUploadForm()`: Switch between PDF and link forms
   - `handleUploadJournal()`: Handle both upload types
   - `loadJournals()`: Fetch and display both journals and links
   - `deleteJournalLink()`: Delete link cards

3. **backend/api/journals.php**
   - Enhanced `add_link` action with URL validation
   - Enhanced `get_links` action to include uploader info
   - Added `delete_link` action for admin/librarian

### Frontend Display

**Link Card Design:**
- Purple gradient background (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
- White text with shadow for readability
- 🔗 link icon badge
- "Visit Website" button
- Uploader info and date

**PDF Journal Card Design:**
- Journal cover image background
- Black text on white overlay
- Download button
- Edit/Delete buttons (for Admin/Librarian)
- Uploader info and date

## Security Features

### URL Validation
- Automatic protocol detection (adds `https://` if missing)
- PHP `filter_var()` validation
- Rejects invalid URLs with clear error messages

### Access Control
- **Upload Links**: All authenticated users
- **Delete Links**: Admin and Librarian roles only
- **View Links**: All authenticated users

### XSS Protection
- HTML escaping for all user-generated content
- Safe URL handling in onclick handlers
- Prepared statements for database queries

## Migration Guide

### Running the Migration
Execute the migration script once to create the `journal_links` table:

```bash
php run_journal_links_migration.php
```

Expected output:
```
✅ Connected to database successfully!
✅ journal_links table created successfully!
📋 Table structure: ...
✅ Table verification: SUCCESS - journal_links table exists!
```

### Rollback (If Needed)
To remove the feature completely:
```sql
DROP TABLE IF EXISTS journal_links;
```

Then revert the code changes in:
- `index.html`
- `js/script.js`
- `backend/api/journals.php`

## Usage Examples

### Example Link Cards
1. **Research Profiles**
   - Title: "Google Scholar Profile"
   - URL: "https://scholar.google.com/citations?user=..."
   - Description: "Dr. Smith's research publications and citations"

2. **Departmental Resources**
   - Title: "Library Database"
   - URL: "https://library.university.edu/databases"
   - Description: "Access to online academic databases"

3. **External Journals**
   - Title: "Nature Journal - Latest Research"
   - URL: "https://nature.com/latest"
   - Description: "Cutting-edge scientific research"

## Testing Checklist

- [ ] Database table `journal_links` exists
- [ ] Upload modal shows type selector dropdown
- [ ] Selecting "PDF Journal" shows PDF form
- [ ] Selecting "External Link Card" shows link form
- [ ] Can upload link cards with valid URLs
- [ ] Invalid URLs are rejected with error message
- [ ] Link cards appear first in journals grid
- [ ] Link cards have purple gradient background
- [ ] Clicking link card opens URL in new tab
- [ ] Admin/Librarian can delete link cards
- [ ] Regular users cannot see delete button
- [ ] PDF journals still work as before
- [ ] Both types sort by creation date

## Troubleshooting

### Issue: Link cards not appearing
**Solution**: Check browser console for JavaScript errors. Ensure `journal_links` table exists.

### Issue: URL validation failing
**Solution**: Make sure URL includes protocol (http:// or https://). The system auto-adds https:// if missing.

### Issue: Can't click link cards
**Solution**: Check if JavaScript loaded properly. Verify no console errors.

### Issue: Delete button not showing
**Solution**: Confirm user role is Admin or Librarian. Check role-based permissions.

## Future Enhancements

Potential improvements for future versions:
- Link categories/tags
- Click tracking/analytics
- Link preview thumbnails
- Bulk link management
- Link expiration dates
- User-specific link visibility

## Support

For issues or questions about this feature, please:
1. Check this documentation first
2. Review the implementation code in the modified files
3. Test with the provided examples
4. Check browser console for errors

---

**Version**: 1.0  
**Last Updated**: March 9, 2026  
**Author**: CPMR Library Development Team
