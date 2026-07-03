import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
	{
		ignores: ["dist/**", "dist-bulletin/**", "node_modules/**", ".papi/**", "tsconfig.tsbuildinfo", "src/generated/**"],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	reactHooks.configs.flat["recommended-latest"],
	eslintConfigPrettier,
	{
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			"react-hooks/immutability": "off",
			"react-hooks/set-state-in-effect": "off",
		},
	},
	{
		files: ["server/**/*.mjs", "scripts/**/*.cjs"],
		languageOptions: {
			globals: {
				BinaryType: "readonly",
				Buffer: "readonly",
				URL: "readonly",
				__dirname: "readonly",
				clearInterval: "readonly",
				clearTimeout: "readonly",
				console: "readonly",
				fetch: "readonly",
				process: "readonly",
				require: "readonly",
				setInterval: "readonly",
				setTimeout: "readonly",
			},
		},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
		},
	},
);
