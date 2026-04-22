/** @type {import('tailwindcss').Config} */
export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	theme: {
		extend: {
			fontFamily: {
				display: ['"Instrument Sans"', "system-ui", "-apple-system", "sans-serif"],
				body: ['"Instrument Sans"', "system-ui", "-apple-system", "sans-serif"],
				mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
			},
		},
	},
	plugins: [],
};
