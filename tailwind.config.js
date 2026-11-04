/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        temple: {
          gold: '#eab308',
          amber: '#d97706',
          crimson: '#991b1b',
          wood: '#451a03',
          jade: '#059669',
        },
      },
    },
  },
  plugins: [],
};
