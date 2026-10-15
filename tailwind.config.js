/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['Poppins', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          bg: '#4467BB',      // outer app background (solid)
          coral: '#E29895',   // gradient panel top / button start
          mauve: '#8B6E9A',   // gradient panel mid
          indigo: '#4E63B0',  // gradient panel bottom / button end
          navy: '#232B4D'     // dark text on light surfaces
        }
      },
      backgroundImage: {
        'panel-gradient': 'linear-gradient(180deg, #E29895 0%, #A87E97 45%, #4E63B0 100%)',
        'button-gradient': 'linear-gradient(90deg, #E29895 0%, #4E63B0 100%)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem'
      },
      keyframes: {
        'panel-in': {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        'card-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'panel-in': 'panel-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        'card-in': 'card-in 0.45s ease-out both'
      }
    }
  },
  plugins: []
}
