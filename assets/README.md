# SurfacesUI Assets

Brand assets for the SurfacesUI component library.

## Logos

### Files

- **SurfacesUI-Light.svg** - Logo for light mode backgrounds (dark text)
- **SurfacesUI-Dark.svg** - Logo for dark mode backgrounds (light text)

### Dimensions

- **Width**: 645px
- **Height**: 150px
- **Aspect Ratio**: 4.3:1

### Usage in Markdown

For automatic dark mode switching in README.md:

```markdown
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/SurfacesUI-Dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/SurfacesUI-Light.svg">
  <img alt="SurfacesUI" src="./assets/SurfacesUI-Light.svg" width="400">
</picture>
```

### Usage in React Components

Import the `Logo` component from `src/apps/Logo.tsx`:

```tsx
import { Logo } from './Logo';

function Header() {
  return (
    <header>
      <Logo height={32} />
    </header>
  );
}
```

The Logo component automatically switches between light and dark variants based on the current theme (using Tailwind's `dark:` modifier).

### Color Palette

**Light Mode Logo:**
- Background layers: `#04243B` (dark navy), `#3A9DEF` (bright blue), `white`
- Cube icon: Gradient from `#3A9DEF` with radial fade

**Dark Mode Logo:**
- Background layers: `white`, `#3A9DEF` (bright blue), `#04243B` (dark navy)
- Cube icon: Gradient from `#3A9DEF` with radial fade

## Design Guidelines

### Minimum Size
- **Web**: 200px width minimum
- **Print**: 2 inches width minimum

### Clear Space
Maintain clear space around the logo equal to the height of the cube icon.

### Don'ts
- Don't stretch or distort the logo
- Don't change the colors
- Don't add effects (drop shadows, gradients, etc.)
- Don't place on busy backgrounds that reduce legibility

### Acceptable Modifications
- Scale proportionally
- Use on solid backgrounds with good contrast
- Convert to single color (monochrome) when necessary

## File Formats

All logos are provided as SVG (vector) for crisp scaling at any size. For raster formats (PNG, JPG), export at 2x resolution for high-DPI displays.

## License

These assets are part of the SurfacesUI project and are licensed under Apache-2.0.
