import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Schibsted Grotesk"', ...defaultTheme.fontFamily.sans],
        sans: ['"Schibsted Grotesk"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        canvas: '#000000',
        panel: '#0d0d0c',
        outline: '#232220',
        accent: '#d0d0d0',
        muted: '#8e8b85',
        paper: '#eeeae3',
      },
      boxShadow: {
        panel: '0 15px 35px rgba(0,0,0,0.65)',
        sleeve: '0 30px 60px -20px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)',
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
