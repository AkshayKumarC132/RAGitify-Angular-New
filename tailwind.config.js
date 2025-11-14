/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366f1',
          foreground: '#eef2ff'
        },
        surface: '#0f172a'
      }
    }
  },
  plugins: []
};
