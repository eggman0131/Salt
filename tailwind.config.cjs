module.exports = {
  content: [
    './index.html',
    './**/*.{js,ts,jsx,tsx}',
    '!./node_modules/**',
    '!./dist/**',
    '!./functions/**',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
