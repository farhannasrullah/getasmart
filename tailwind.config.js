/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Memindai semua komponen
    "./app/**/*.{js,ts,jsx,tsx}"  
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}