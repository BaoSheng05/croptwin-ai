/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        /* ── Structural Greens ────────────────────────────── */
        "light-green":   "#90EE90",   // Header background
        "spring-green":  "#00FF7F",   // Sidebar background
        "forest-green":  "#228B22",   // Active nav item background
        "dark-green":    "#145A32",   // Logo badge, strong accents

        /* ── Content Area ─────────────────────────────────── */
        "app-bg":        "#F0F7F0",   // Main content soft mint
        "card-bg":       "#FFFFFF",   // Card white
        "card-border":   "#B3D4B3",   // Card/section borders
        "field-bg":      "#EAF5EA",   // Inset/reading backgrounds

        /* ── Typography ───────────────────────────────────── */
        "ink":           "#000000",   // Primary text — maximum legibility
        "muted":         "#2D4A2D",   // Secondary text — dark green-grey

        /* ── Status (flat, no neon) ───────────────────────── */
        "status-healthy":  "#1E8449",
        "status-warning":  "#C27B00",
        "status-critical": "#C0392B",
        "status-offline":  "#7F8C8D",

        /* ── Accent palette (for new components) ─────────── */
        "mint":   "#2E8B57",
        "lime":   "#6DBF47",
        "amber":  "#C27B00",
        "coral":  "#C0392B",
        "cyan":   "#2980B9",
        "violet": "#7D3C98",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  plugins: [],
};
