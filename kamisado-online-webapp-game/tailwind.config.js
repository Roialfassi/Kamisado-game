/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kamisado: {
          brown: '#5D4037',
          green: '#2E7D32',
          red: '#C62828',
          yellow: '#FBC02D',
          pink: '#EC407A',
          purple: '#7B1FA2',
          blue: '#1565C0',
          orange: '#EF6C00',
          lacquer: '#2b1810',
          stone: '#3d3229',
        },
      },
      fontFamily: {
        display: ['"Noto Serif JP"', 'serif'],
      },
    },
  },
  plugins: [],
};
