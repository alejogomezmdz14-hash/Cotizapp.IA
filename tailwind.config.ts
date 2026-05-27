import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "rgb(var(--border-rgb) / <alpha-value>)",
        input: "rgb(var(--input-border-rgb) / <alpha-value>)",
        ring: "rgb(var(--accent-rgb) / <alpha-value>)",
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        primary: {
          DEFAULT: "#00E5A0",
          foreground: "#000000",
        },
        secondary: {
          DEFAULT: "rgb(var(--surface-2-rgb) / <alpha-value>)",
          foreground: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(239 68 68 / <alpha-value>)",
          foreground: "rgb(255 255 255 / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--surface-2-rgb) / <alpha-value>)",
          foreground: "rgb(var(--text-secondary-rgb) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "#00E5A0",
          foreground: "#000000",
        },
        popover: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--surface-rgb) / <alpha-value>)",
          foreground: "rgb(var(--text-primary-rgb) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "rgb(var(--sidebar-bg-rgb) / <alpha-value>)",
          foreground: "rgb(var(--sidebar-text-rgb) / <alpha-value>)",
          active: "#00E5A0",
          muted: "rgb(var(--sidebar-text-muted-rgb) / <alpha-value>)",
        },
        header: {
          DEFAULT: "rgb(var(--header-bg-rgb) / <alpha-value>)",
          foreground: "rgb(var(--header-text-rgb) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
};
export default config;
