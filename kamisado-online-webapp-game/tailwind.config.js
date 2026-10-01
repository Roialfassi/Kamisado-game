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
          lacquer: '#090b10',
          boardBorder: '#361d12',
          woodDark: '#221109',
          woodLight: '#4a2919',
          stone: '#241a15',
          gold: '#d4af37',
          goldLight: '#f5e6c8',
        },
        ink: {
          950: '#07080c',
          900: '#0b0d13',
          800: '#11141c',
          700: '#181c27',
          600: '#222736',
        },
        accent: {
          DEFAULT: '#f5c451',
          soft: '#ffe3a1',
          deep: '#e0a21c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        brand: ['"Noto Serif JP"', '"Hiragino Mincho ProN"', '"Yu Mincho"', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'pop-in': 'pop-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
