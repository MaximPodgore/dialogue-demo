/** @type {import('tailwindcss').Config} */
const defaultTheme = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary purple/magenta used for accents (buttons, highlights)
        'primary': {
          DEFAULT: '#b43f7f',
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#b43f7f',
          600: '#a03471',
          700: '#881c5c',
          800: '#701a4d',
          900: '#5a1640',
        },
        // Light gray background
        'lavender': '#f8f6f3',
        // Page background (off-white)
        'pageBg': '#fcfbf9',
        // Card and panel backgrounds (white)
        'card': colors.white,
        // Muted body text
        'muted': '#747474',
        // Accent / lighter gray used for placeholders and faint fills
        'accent': '#f8f6f3',
        // Placeholder area color used on the large left panel
        'placeholder': '#f8f6f3',
      },
      fontFamily: {
        sans: ['DM Sans', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
