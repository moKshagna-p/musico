import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', ...defaultTheme.fontFamily.serif],
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        canvas: '#020202',
        panel: '#0a0a0a',
        outline: '#1c1c1c',
        accent: '#d0d0d0',
        muted: '#8a8a8a',
      },
      boxShadow: {
        panel: '0 15px 35px rgba(0,0,0,0.65)',
      },
      screens: {
        desktop: '1920px',
        laptop: '1440px',
        tablet: '1024px',
      },
      animation: {
        shimmer: 'shimmer 1.8s ease-in-out infinite',
        vinylSpin: 'vinylSpin 6s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-700px 0' },
          '100%': { backgroundPosition: '700px 0' },
        },
        vinylSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}
