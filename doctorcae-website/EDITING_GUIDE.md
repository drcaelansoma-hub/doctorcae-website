# How to Edit Your Website in Cursor

## Quick Start: See Your Changes Live

1. **Open your HTML file** in Cursor (like `index.html`)
2. **Right-click** in the code editor
3. **Click "Open with Live Server"** (if you have the extension) OR
4. **Open the file in your browser** manually:
   - Right-click the file in Finder
   - Choose "Open With" → "Google Chrome" or "Safari"
   - Keep the browser open while you edit

## Common Edits Made Easy

### Change Text Content
**Find:** The text you want to change (use Cmd+F to search)
**Example:**
```html
<h1>Nurturing, calm, child‑centred care</h1>
```
Change "Nurturing, calm, child‑centred care" to whatever you want!

### Change Colors
**Find:** Color codes like `#3b6c94` or `var(--primary)`
**Example:**
```css
color: #3b6c94;  /* This is blue */
```
Change `#3b6c94` to any color you want (like `#ff0000` for red)

### Add New Text Section
**Find:** Where you want to add content
**Add:** A new paragraph like this:
```html
<p>Your new text here</p>
```

### Change Images
**Find:** `<img src="Logo.svg"` 
**Change:** The filename to your new image:
```html
<img src="your-new-image.png" alt="Description">
```

## Tips for Editing

1. **Use Search (Cmd+F)**: Find text quickly without scrolling
2. **Save Often (Cmd+S)**: Your changes auto-save, but save manually too
3. **Check Browser**: Refresh your browser to see changes
4. **Don't Delete Tags**: Keep the `<` and `>` symbols - they're important!

## What NOT to Touch

- Don't delete: `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`, `</html>`
- Don't break: Opening tags like `<div>` need closing tags `</div>`
- Don't remove: The `<style>` section unless you know what you're doing

## Need Help?

- **Can't find text?** Use Cmd+F to search
- **Made a mistake?** Use Cmd+Z to undo
- **Want to see changes?** Save (Cmd+S) and refresh your browser
