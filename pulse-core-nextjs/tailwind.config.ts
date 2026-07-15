import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            borderRadius: {
                card: "var(--radius-card)",
                control: "var(--radius-control)",
            },
            boxShadow: {
                card: "var(--card-shadow)",
                "card-hover": "var(--card-shadow-hover)",
            },
            spacing: {
                section: "var(--space-section)",
                card: "var(--space-card)",
                "card-compact": "var(--space-card-compact)",
            },
            colors: {
                // AfyaHero Blue Palette: #1B262C / #0F4C75 / #3282B8 / #BBE1FA
                forest: {
                    DEFAULT: "var(--forest)",
                    mid: "var(--forest-mid)",
                    light: "var(--forest-light)",
                },
                emerald: {
                    DEFAULT: "var(--emerald)",
                    light: "var(--sage)",
                },
                sage: "var(--sage)",
                mint: "var(--mint)",
                white: "var(--white)",
                "off-white": "var(--off-white)",
                paper: "var(--paper)",
                fog: "var(--fog)",
                ink: "var(--ink)",
                charcoal: "var(--charcoal)",
                slate: "var(--slate)",
                mist: "var(--mist)",
                glass: "rgba(255, 255, 255, 0.03)",
                // Portal accent
                "portal-primary": "var(--portal-primary)",
                "portal-primary-hover": "var(--portal-primary-hover)",
                "portal-primary-light": "var(--portal-primary-light)",
                // Per-portal accents (must match layout.tsx ACCENT constants)
                "portal-reception": "#D97706",
                "portal-medical": "#2563EB",
                "portal-lab": "#7C3AED",
                "portal-pharmacy": "#059669",
                "portal-admin": "#DC2626",
                // Severity colors
                "severity-high": "var(--severity-high)",
                "severity-high-bg": "var(--severity-high-bg)",
                "severity-medium": "var(--severity-medium)",
                "severity-medium-bg": "var(--severity-medium-bg)",
                "severity-low": "var(--severity-low)",
                "severity-low-bg": "var(--severity-low-bg)",
                // AI content
                "ai-badge-bg": "var(--ai-badge-bg)",
                "ai-badge-text": "var(--ai-badge-text)",
                "ai-confirmed-bg": "var(--ai-confirmed-bg)",
                "ai-confirmed-text": "var(--ai-confirmed-text)",
                // Content area
                "content-bg": "var(--content-bg)",
                "content-canvas": "var(--content-canvas)",
                "content-surface": "var(--content-surface)",
                "content-border": "var(--content-border)",
                vanilla: "var(--vanilla)",
            },
            fontFamily: {
                serif: ["var(--font-serif)", "serif"],
                sans: ["var(--font-sans)", "sans-serif"],
                mono: ["var(--font-mono)", "monospace"],
                logo: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
                "gradient-conic":
                    "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
            },
            keyframes: {
                shimmer: {
                    "0%": { transform: "translateX(-100%)" },
                    "100%": { transform: "translateX(100%)" },
                },
            },
            animation: {
                shimmer: "shimmer 1.5s infinite",
            },
        },
    },
    plugins: [],
};
export default config;