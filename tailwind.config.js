/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // This adds the cozy rounded font look
        sans: ['Quicksand', 'sans-serif'],
        serif: ['Comfortaa', 'cursive'],
      },
    },
  },
  plugins: [],
}