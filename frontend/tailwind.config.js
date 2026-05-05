/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#07100d",
        panel: "#101714",
        field: "#16231d",
        mint: "#7ddf96",
        lime: "#b7f36b",
        amber: "#f8c05a",
        coral: "#ff6f61",
        cyan: "#6bd8ff",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 223, 150, 0.16), 0 18px 60px rgba(0, 0, 0, 0.36)",
      },
    },
  },
  plugins: [],
};
