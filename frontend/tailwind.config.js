/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        input: "hsl(214 32% 91%)",
        ring: "hsl(222 84% 5%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 84% 5%)",
        primary: {
          DEFAULT: "hsl(222 84% 5%)",
          foreground: "hsl(210 40% 98%)",
        },
      },
    },
  },
  plugins: [],
};