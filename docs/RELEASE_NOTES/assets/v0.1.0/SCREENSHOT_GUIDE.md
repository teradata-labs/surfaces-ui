# v0.1.0 Screenshot Guide

Save your screenshots in this directory with these exact filenames:

## Required Screenshots

1. **01-json-render-initial-state.png**
   - json-render app initial state
   - Centered prompt input with theme toggle
   - Example prompts visible

2. **02-json-render-table-success.png**
   - Table generation successful
   - Side-by-side layout (30/70 split)
   - All columns visible: id, name, product, category, value, amount, region, status, date

3. **03-json-render-chart-with-controls.png**
   - Chart with controls panel
   - Line chart rendered
   - Chart Options panel expanded showing dropdowns

4. **04-json-render-raw-json-view.png**
   - Raw JSON view
   - Both chart and JSON spec visible

5. **05-json-render-sqlresults-display.png**
   - SQLResultsDisplay organism
   - Table/chart toggle visible
   - Export buttons visible

6. **06-json-render-light-mode.png**
   - Table in light mode

7. **07-json-render-dark-mode.png**
   - Same table in dark mode

## File Format

- Format: PNG
- Target size: < 500KB per image (compress if needed)
- Resolution: 1400-1600px width recommended

## Saving Screenshots

### On macOS:
```bash
# Option 1: Capture specific area
Cmd + Shift + 4  # Then drag to select area

# Option 2: Capture entire window
Cmd + Shift + 4  # Then press Space, click window

# Screenshots save to Desktop by default
# Move them to this directory:
mv ~/Desktop/Screenshot*.png /path/to/surfaces-ui/docs/RELEASE_NOTES/assets/v0.1.0/

# Rename according to the list above
```

### On Windows:
```bash
# Use Snipping Tool or Snip & Sketch
# Save directly to this directory with correct filenames
```

## Verification

After adding screenshots, verify they display correctly:

```bash
# Open the release notes in a markdown viewer
code docs/RELEASE_NOTES/v0.1.0.md

# Or generate a preview
```

## Current Status

- [ ] 01-json-render-initial-state.png
- [ ] 02-json-render-table-success.png
- [ ] 03-json-render-chart-with-controls.png
- [ ] 04-json-render-raw-json-view.png
- [ ] 05-json-render-sqlresults-display.png
- [ ] 06-json-render-light-mode.png
- [ ] 07-json-render-dark-mode.png

Once all screenshots are added, commit them:

```bash
git add docs/RELEASE_NOTES/assets/v0.1.0/*.png
git commit -m "docs: add screenshots for v0.1.0 release notes"
```
