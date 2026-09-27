/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kamisado: {
          brown: '#572600',
          green: '#009157',
          red: '#d23339',
          yellow: '#e3c301',
          pink: '#d2719e',
          purple: '#6f3787',
          blue: '#006bab',
          orange: '#d77522',
          lacquer: '#170e0a',
          boardBorder: '#361d12',
          woodDark: '#221109',
          woodLight: '#4a2919',
          stone: '#241a15',
          gold: '#d4af37',
          goldLight: '#f5e6c8',
        },
      },
      fontFamily: {
        display: ['"Noto Serif JP"', 'serif'],
      },
    },
  },
  plugins: [],
};
