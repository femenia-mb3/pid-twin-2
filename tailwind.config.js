/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        segittur: {
          red: "#E30613",
          darkred: "#990000",
          navy: "#0B1120",
          slate: "#1E293B",
          cyan: "#0EA5E9",
          emerald: "#10B981",
          amber: "#F59E0B"
        }
      }
    },
  },
  plugins: [],
}
