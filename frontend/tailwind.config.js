/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: { 500: "#3B82F6", 600: "#2563EB", 700: "#1D4ED8" },
        severity: { critical: "#DC2626", high: "#F97316", medium: "#EAB308", low: "#6B7280" },
        camera: { online: "#22C55E", offline: "#EF4444", degraded: "#F59E0B", unknown: "#6B7280" },
        navy: { 900: "#0F172A", 800: "#1E293B", 700: "#334155" },
      },
    },
  },
  plugins: [],
};
