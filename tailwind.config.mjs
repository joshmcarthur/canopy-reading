/** @type {import('tailwindcss').Config} */
export default {
	content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
	theme: {
		extend: {
			colors: {
				background: "rgb(var(--background) / <alpha-value>)",
				foreground: "rgb(var(--foreground) / <alpha-value>)",
				card: {
					DEFAULT: "rgb(var(--card) / <alpha-value>)",
					foreground: "rgb(var(--card-foreground) / <alpha-value>)",
				},
				popover: {
					DEFAULT: "rgb(var(--popover) / <alpha-value>)",
					foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
				},
				primary: {
					DEFAULT: "rgb(var(--primary) / <alpha-value>)",
					foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
				},
				secondary: {
					DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
					foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
				},
				muted: {
					DEFAULT: "rgb(var(--muted) / <alpha-value>)",
					foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
				},
				accent: {
					DEFAULT: "rgb(var(--accent) / <alpha-value>)",
					foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
				},
				destructive: {
					DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
					foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
				},
				border: "rgb(var(--border) / <alpha-value>)",
				input: "rgb(var(--input) / <alpha-value>)",
				ring: "rgb(var(--ring) / <alpha-value>)",
				// Cozy palette colors
				cream: {
					50: "rgb(var(--cream-50) / <alpha-value>)",
					100: "rgb(var(--cream-100) / <alpha-value>)",
					200: "rgb(var(--cream-200) / <alpha-value>)",
					300: "rgb(var(--cream-300) / <alpha-value>)",
				},
				paper: {
					50: "rgb(var(--paper-50) / <alpha-value>)",
					100: "rgb(var(--paper-100) / <alpha-value>)",
					200: "rgb(var(--paper-200) / <alpha-value>)",
				},
				charcoal: {
					900: "rgb(var(--charcoal-900) / <alpha-value>)",
					800: "rgb(var(--charcoal-800) / <alpha-value>)",
					700: "rgb(var(--charcoal-700) / <alpha-value>)",
				},
				sage: {
					400: "rgb(var(--sage-400) / <alpha-value>)",
					500: "rgb(var(--sage-500) / <alpha-value>)",
				},
				rose: {
					200: "rgb(var(--rose-200) / <alpha-value>)",
					300: "rgb(var(--rose-300) / <alpha-value>)",
				},
				"soft-gray": "rgb(var(--soft-gray) / <alpha-value>)",
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			fontFamily: {
				sans: [
					"Inter",
					"-apple-system",
					"BlinkMacSystemFont",
					"Segoe UI",
					"sans-serif",
				],
				serif: ["Roboto Serif", "Georgia", "serif"],
			},
			fontSize: {
				xs: ["0.75rem", { lineHeight: "1.5" }],
				sm: ["0.875rem", { lineHeight: "1.6" }],
				base: ["1rem", { lineHeight: "1.75" }],
				lg: ["1.125rem", { lineHeight: "1.75" }],
				xl: ["1.25rem", { lineHeight: "1.7" }],
				"2xl": ["1.5rem", { lineHeight: "1.6" }],
				"3xl": ["1.875rem", { lineHeight: "1.5" }],
				"4xl": ["2.25rem", { lineHeight: "1.4" }],
			},
		},
	},
	plugins: [],
};
