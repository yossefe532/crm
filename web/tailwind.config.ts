import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: {
          0: "rgb(var(--base-0) / <alpha-value>)",
          50: "rgb(var(--base-50) / <alpha-value>)",
          100: "rgb(var(--base-100) / <alpha-value>)",
          200: "rgb(var(--base-200) / <alpha-value>)",
          300: "rgb(var(--base-300) / <alpha-value>)",
          400: "rgb(var(--base-400) / <alpha-value>)",
          500: "rgb(var(--base-500) / <alpha-value>)",
          600: "rgb(var(--base-600) / <alpha-value>)",
          700: "rgb(var(--base-700) / <alpha-value>)",
          800: "rgb(var(--base-800) / <alpha-value>)",
          900: "rgb(var(--base-900) / <alpha-value>)"
        },
        brand: {
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)"
        },
        primary: "rgb(var(--primary) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        text: {
          primary: "rgb(var(--text-primary-rgb) / <alpha-value>)",
          invert: "rgb(var(--text-invert) / <alpha-value>)"
        },
        surface: {
          DEFAULT: "rgb(var(--surface) / <alpha-value>)",
          muted: "rgb(var(--surface-muted) / <alpha-value>)"
        }
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
        soft: "var(--shadow-soft)"
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-120%)" },
          "100%": { transform: "translateX(120%)" }
        },
        pulseGold: {
          "0%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.2)" },
          "100%": { opacity: "0.6", transform: "scale(1)" }
        }
      },
      animation: {
        shimmer: "shimmer 0.6s ease",
        pulseGold: "pulseGold 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
}

export default config
