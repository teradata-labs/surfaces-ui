import type { Config } from 'tailwindcss';

export default {
  // Tailwind v4: Theme configuration is in tokens.css via @theme blocks
  // This config file is minimal - only content paths
  // Note: v3 plugins removed - migrate animations to CSS @keyframes in tokens.css
  content: ['./src/**/*.{ts,tsx,html}'],
  plugins: [],
} satisfies Config;
