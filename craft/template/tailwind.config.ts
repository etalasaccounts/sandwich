import type { Config } from "tailwindcss";

// The design system uses stock zinc/green-400/cyan-400/orange-500 Tailwind
// utilities on purpose — no CSS-variable token layer. See
// docs/design-system/foundations.md; never add custom colors here.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
