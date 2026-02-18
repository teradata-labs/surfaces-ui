import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import typography from '@tailwindcss/typography';

export default {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,html}'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
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
        'chat-gradient-start': 'hsl(var(--chat-gradient-start))',
        'chat-gradient-end': 'hsl(var(--chat-gradient-end))',
        'chat-input-bg': 'hsl(var(--chat-input-bg))',
        'chat-message-bg': 'hsl(var(--chat-message-bg))',
        'chat-user-bg': 'hsl(var(--chat-user-bg))',
        'chat-user-text': 'hsl(var(--chat-user-text))',
      },
      fontFamily: {
        inter: ['Inter', 'Arial', 'sans-serif'],
      },
      fontSize: {
        'headline-1': ['96px', { lineHeight: '116px', fontWeight: '300' }],
        'headline-2': ['60px', { lineHeight: '72px', fontWeight: '300' }],
        'headline-3': ['48px', { lineHeight: '56px', fontWeight: '400' }],
        'headline-4': ['34px', { lineHeight: '40px', fontWeight: '400' }],
        'headline-5': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'headline-6': ['20px', { lineHeight: '32px', fontWeight: '500' }],
        'subtitle-1': ['16px', { lineHeight: '28px', fontWeight: '400' }],
        'subtitle-2': ['14px', { lineHeight: '24px', fontWeight: '500' }],
        'body-1': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-2': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        button: ['14px', { lineHeight: '36px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '20px', fontWeight: '400' }],
      },
      backgroundImage: {
        'gradient-chat': 'var(--gradient-chat)',
        'gradient-glow': 'var(--gradient-glow)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
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
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
