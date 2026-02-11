import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.tsx',
    './pages/**/*.tsx',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
