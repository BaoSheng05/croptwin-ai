/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#050a08",
        surface: "#0a110e",
        panel: "#0d1613",
        field: "#131f1a",
        elevated: "#1a2b24",
        mint: "#7ddf96",
        lime: "#b7f36b",
        amber: "#f8c05a",
        coral: "#ff6f61",
        cyan: "#6bd8ff",
        violet: "#a78bfa",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 223, 150, 0.08), 0 24px 80px rgba(0, 0, 0, 0.5)",
        "glow-sm": "0 0 0 1px rgba(125, 223, 150, 0.06), 0 8px 30px rgba(0, 0, 0, 0.3)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
