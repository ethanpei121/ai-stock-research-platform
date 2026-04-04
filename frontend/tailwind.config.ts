import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0a0e17",
          "bg-alt": "#0f1421",
          card: "#111827",
          "card-hover": "#1a2236",
          border: "rgba(255,255,255,0.06)",
          "border-hover": "rgba(255,255,255,0.12)",
          "border-accent": "rgba(99,102,241,0.3)",
          muted: "#94a3b8",
          dim: "#64748b",
          text: "#f1f5f9",
          "text-secondary": "#cbd5e1",
        },
        accent: {
          DEFAULT: "#818cf8",
          light: "#a5b4fc",
          dark: "#6366f1",
          muted: "rgba(99,102,241,0.15)",
          glow: "rgba(129,140,248,0.2)",
        },
        gain: {
          DEFAULT: "#10b981",
          bg: "rgba(16,185,129,0.12)",
          border: "rgba(16,185,129,0.25)",
        },
        loss: {
          DEFAULT: "#ef4444",
          bg: "rgba(239,68,68,0.12)",
          border: "rgba(239,68,68,0.25)",
        },
        "cn-gain": {
          DEFAULT: "#ef4444",
          bg: "rgba(239,68,68,0.12)",
        },
        "cn-loss": {
          DEFAULT: "#10b981",
          bg: "rgba(16,185,129,0.12)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          bg: "rgba(245,158,11,0.12)",
          border: "rgba(245,158,11,0.25)",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 20px rgba(99,102,241,0.15)",
        "glow-sm": "0 0 10px rgba(99,102,241,0.1)",
        card: "0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.4), 0 0 20px rgba(99,102,241,0.08)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flash-green": "flashGreen 0.6s ease-out",
        "flash-red": "flashRed 0.6s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-in-right": "slideInRight 0.3s ease-out",
      },
      keyframes: {
        flashGreen: {
          "0%": { color: "#10b981", textShadow: "0 0 8px rgba(16,185,129,0.5)" },
          "100%": { color: "inherit", textShadow: "none" },
        },
        flashRed: {
          "0%": { color: "#ef4444", textShadow: "0 0 8px rgba(239,68,68,0.5)" },
          "100%": { color: "inherit", textShadow: "none" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(12px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      backgroundImage: {
        "grid-pattern": "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;
