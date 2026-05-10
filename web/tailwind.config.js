/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		extend: {
			colors: {
				// fg tokens — use with text-*
				primary: 'var(--fg-primary)',
				'primary-inverted': 'var(--fg-primary-inverted)',
				secondary: 'var(--fg-secondary)',
				'secondary-hover': 'var(--fg-secondary-hover)',
				tertiary: 'var(--fg-tertiary)',
				link: 'var(--fg-link)',
				'link-hover': 'var(--fg-link-hover)',
				error: 'var(--fg-error)',
				warning: 'var(--fg-warning)',
				success: 'var(--fg-success)',

				// bg tokens — use with bg-*
				'surface-main': 'var(--bg-surface-main)',
				'surface-container': 'var(--bg-surface-container)',
				'surface-nested': 'var(--bg-surface-nested)',
				'surface-overlay': 'var(--bg-surface-overlay)',
				'selection-container-hover': 'var(--bg-selection-container-hover)',
				'selection-container-active': 'var(--bg-selection-container-active)',
				'action-primary': 'var(--bg-action-primary)',
				'action-primary-hover': 'var(--bg-action-primary-hover)',
				'action-secondary': 'var(--bg-action-secondary)',
				'action-secondary-hover': 'var(--bg-action-secondary-hover)',
				'status-error': 'var(--bg-status-error)',
				'status-warning': 'var(--bg-status-warning)',
			},
			borderColor: {
				DEFAULT: 'var(--border-default)',
				divider: 'var(--border-divider)',
				error: 'var(--border-error)',
				success: 'var(--border-success)',
				warning: 'var(--border-warning)',
			},
			boxShadow: {
				1: 'var(--shadow-1)',
				2: 'var(--shadow-2)',
				3: 'var(--shadow-3)',
			},
			borderRadius: {
				container: 'var(--radius-container)',
				nested: 'var(--radius-nested)',
				small: 'var(--radius-small)',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				display: ['"DM Serif Display"', 'Georgia', 'serif'],
				mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
			},
		},
	},
	plugins: [],
};
