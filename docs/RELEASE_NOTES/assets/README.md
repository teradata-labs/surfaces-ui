# Release Notes Assets

This directory contains images and other assets for release notes.

## Directory Structure

```
assets/
├── README.md          # This file
├── v0.1.0/           # Assets for release v0.1.0
│   ├── 01-*.png
│   ├── 02-*.png
│   └── ...
├── v0.2.0/           # Assets for release v0.2.0 (future)
└── vX.Y.Z/           # Assets for each release
```

## Naming Convention

Use descriptive, sequential names:

```
[sequence]-[feature]-[description].png

Examples:
01-json-render-initial-state.png
02-json-render-table-success.png
03-json-render-chart-with-controls.png
04-json-render-raw-json-view.png
05-json-render-sqlresults-display.png
06-json-render-light-mode.png
07-json-render-dark-mode.png
```

## Image Guidelines

### File Format
- **Screenshots**: PNG (lossless, good for UI)
- **Diagrams**: SVG (when possible) or PNG
- **Photos**: JPG

### File Size
- Keep screenshots under 500KB when possible
- Use PNG compression tools if needed
- Optimize before committing

### Dimensions
- **Full window**: 1400-1600px width recommended
- **Partial UI**: Scale appropriately
- **Retina/HiDPI**: 2x resolution is acceptable but compress well

## Referencing in Release Notes

Use relative paths from the release notes file:

```markdown
![Initial State](./assets/v0.1.0/01-json-render-initial-state.png)
```

Or with descriptive alt text:

```markdown
![json-render app showing centered prompt input with theme toggle](./assets/v0.1.0/01-json-render-initial-state.png)
*json-render app initial state with centered prompt and example prompts*
```

## Accessibility

Always include:
- Descriptive alt text
- Optional caption below image
- Descriptive filename

**Good**:
```markdown
![json-render table view showing filterable data with all columns visible](./assets/v0.1.0/02-json-render-table-success.png)
*Table successfully rendered with columns: id, name, product, category, value, amount, region, status, date*
```

**Bad**:
```markdown
![screenshot](./assets/v0.1.0/img.png)
```

## Git LFS (Optional)

For large images or many screenshots, consider Git LFS:

```bash
# Install Git LFS
git lfs install

# Track large image files
git lfs track "docs/RELEASE_NOTES/assets/**/*.png"

# Commit .gitattributes
git add .gitattributes
git commit -m "chore: configure Git LFS for release assets"
```

## Cleanup Policy

Keep assets for:
- **All releases**: Images referenced in release notes should remain
- **Current + previous 2 major versions**: At minimum

Archive or remove:
- Unreferenced test images
- Duplicate screenshots
- Superseded images after major redesigns
