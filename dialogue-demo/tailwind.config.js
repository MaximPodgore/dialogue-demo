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
        // Primary purple used for accents (buttons, highlights)
        primary: {
          DEFAULT: '#6B46FF',
          50: '#F7F3FF',
          100: '#F0E9FF',
          200: '#D9C8FF',
          300: '#C0A7FF',
          400: '#A57CFF',
          500: '#6B46FF',
          600: '#5936E6',
          700: '#4326B3',
          800: '#341A8A',
          900: '#2A1266',
        },
        // Soft lavender background seen in the screenshot
        lavender: '#F3E8FF',
        // Page background (off-white / very pale lavender)
        pageBg: '#FBF8FF',
        // Card and panel backgrounds (white)
        card: colors.white,
        // Subtle border color between sections
        border: '#E6E1EB',
        // Muted body text
        muted: '#6B7280',
        // Accent / lighter purple used for placeholders and faint fills
        accent: '#D9C8FF',
        // Placeholder area color used on the large left panel
        placeholder: '#F0E9FF',
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
}
