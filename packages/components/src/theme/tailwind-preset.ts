import type { Config } from 'tailwindcss';

const preset: Config = {
  content: [],
  // darkMode is configured via @custom-variant in tokens.css
  theme: {
    extend: {
      /* ── Semantic Colors (shadcn/ui pattern) ─────────────────────── */
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chat: {
          'gradient-start': 'hsl(var(--chat-gradient-start))',
          'gradient-end': 'hsl(var(--chat-gradient-end))',
          'input-bg': 'hsl(var(--chat-input-bg))',
          'message-bg': 'hsl(var(--chat-message-bg))',
          'user-bg': 'hsl(var(--chat-user-bg))',
          'user-text': 'hsl(var(--chat-user-text))',
        },
        gray: {
          50: 'hsl(var(--gray-50))',
          100: 'hsl(var(--gray-100))',
          200: 'hsl(var(--gray-200))',
          300: 'hsl(var(--gray-300))',
          400: 'hsl(var(--gray-400))',
          500: 'hsl(var(--gray-500))',
          600: 'hsl(var(--gray-600))',
          700: 'hsl(var(--gray-700))',
          800: 'hsl(var(--gray-800))',
          900: 'hsl(var(--gray-900))',
        },
        /* ── Brand Palette ───────────────────────────────────────── */
        brand: {
          /* CSS-var theme tokens */
          'dark-blue': 'hsl(var(--brand-dark-blue))',
          'darker-blue': 'hsl(var(--brand-darker-blue))',
          'darkest-blue': 'hsl(var(--brand-darkest-blue))',
          'primary-blue': 'hsl(var(--brand-primary-blue))',
          primary: {
            DEFAULT: '#3053f4',
            50: '#eef1fe',
            100: '#dde3fd',
            200: '#bbc7fb',
            300: '#99abf9',
            400: '#778ff7',
            500: '#3053f4',
            600: '#2642c3',
            700: '#1d3292',
            800: '#132162',
            900: '#0a1131',
          },
          secondary: {
            DEFAULT: '#00233c',
            50: '#e6eaed',
            100: '#ccd5db',
            200: '#99abb7',
            300: '#668193',
            400: '#33526f',
            500: '#00233c',
            600: '#001c30',
            700: '#001524',
            800: '#000e18',
            900: '#00070c',
          },
          tertiary: {
            DEFAULT: '#ff5f02',
            50: '#fff0e6',
            100: '#ffe0cc',
            200: '#ffc199',
            300: '#ffa366',
            400: '#ff8133',
            500: '#ff5f02',
            600: '#cc4c02',
            700: '#993901',
            800: '#662601',
            900: '#331300',
          },
          positive: {
            DEFAULT: '#036600',
            50: '#e6f2e6',
            100: '#cce5cc',
            200: '#99cb99',
            300: '#66b166',
            400: '#349b34',
            500: '#036600',
            600: '#025200',
            700: '#023d00',
            800: '#012900',
            900: '#011400',
          },
          caution: {
            DEFAULT: '#f38800',
            50: '#fef3e6',
            100: '#fde7cc',
            200: '#fbcf99',
            300: '#f9b766',
            400: '#f79f33',
            500: '#f38800',
            600: '#c26d00',
            700: '#925200',
            800: '#613700',
            900: '#311b00',
          },
          negative: {
            DEFAULT: '#ae1209',
            50: '#f7e7e6',
            100: '#efcfce',
            200: '#df9f9c',
            300: '#cf6f6b',
            400: '#bf3f39',
            500: '#ae1209',
            600: '#8b0e07',
            700: '#680b05',
            800: '#460703',
            900: '#230402',
          },
          surface: {
            DEFAULT: '#ffffff',
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#eeeeee',
            300: '#e0e0e0',
            400: '#bdbdbd',
            500: '#9e9e9e',
            600: '#757575',
            700: '#616161',
            800: '#424242',
            900: '#212121',
          },
          text: {
            DEFAULT: '#1a1a1a',
            primary: '#1a1a1a',
            secondary: '#666666',
            disabled: '#9e9e9e',
            inverse: '#ffffff',
          },
        },
      },

      /* ── Font Family ─────────────────────────────────────────────── */
      fontFamily: {
        inter: ['Inter', 'Arial', 'sans-serif'],
      },

      /* ── Typography Scale ────────────────────────────────────────── */
      fontSize: {
        'headline-1': ['2.25rem', { lineHeight: '2.75rem', fontWeight: '700' }],
        'headline-2': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'headline-3': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'headline-4': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'headline-5': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'headline-6': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'body-1': ['1rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        'body-2': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
      },

      /* ── Border Radius ───────────────────────────────────────────── */
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      /* ── Keyframes ───────────────────────────────────────────────── */
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },

      /* ── Animations ──────────────────────────────────────────────── */
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },

      /* ── Background Images (Gradients) ───────────────────────────── */
      backgroundImage: {
        'gradient-chat': 'var(--gradient-chat)',
        'gradient-glow': 'var(--gradient-glow)',
      },

      /* ── Opacity Scale ───────────────────────────────────────────── */
      opacity: {
        '4': '0.04',
        '8': '0.08',
        '12': '0.12',
        '16': '0.16',
        '38': '0.38',
        '74': '0.74',
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('tailwindcss-animate'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tailwindcss/typography'),
  ],
};

export default preset;
