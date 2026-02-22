import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

/**
 * Tailwind Configuration for Salt
 * 
 * AI INSTRUCTION:
 * This config extends Tailwind with Salt's design system.
 * - Custom breakpoints target specific devices (Pixel 8 Pro, iPad Pro, laptops)
 * - Spring animation plugin adds .transition-spring utility
 * - All design tokens (colors, spacing, shadows) defined in index.css
 * 
 * TO MODIFY:
 * - Breakpoints: Change screen sizes for different target devices
 * - Colors/spacing: Edit styles/index.css (tokens propagate here automatically)
 * - Add plugins: Install and register in plugins array
 */

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.tsx',
    './pages/**/*.tsx',
    './modules/**/*.tsx',
    './shared/**/*.tsx',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    screens: {
      sm: '640px',   // Large phones, small tablets
      md: '1024px',  // iPad Pro 12.9" portrait
      lg: '1440px',  // Modern laptops
      xl: '1920px',  // Large desktop monitors
    },
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      spacing: {
        '1': 'var(--space-1)',
        '2': 'var(--space-2)',
        '3': 'var(--space-3)',
        '4': 'var(--space-4)',
        '5': 'var(--space-5)',
        '6': 'var(--space-6)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [
    // Spring Animation Plugin
    // AI: Use .transition-spring for bouncy, playful animations
    plugin(({ addUtilities }) => {
      addUtilities({
        '.transition-spring': {
          'transition-timing-function': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          'transition-duration': '200ms',
          'transition-property': 'all',
        },
        '.transition-spring-transform': {
          'transition-timing-function': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          'transition-duration': '200ms',
          'transition-property': 'transform',
        },
        '.transition-spring-opacity': {
          'transition-timing-function': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          'transition-duration': '200ms',
          'transition-property': 'opacity',
        },
      });
    }),
  ],
} satisfies Config;
