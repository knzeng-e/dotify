import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

import { assertProductionEnvironment } from "./src/shared/config/deploymentSafety";

export default defineConfig(({ command, mode }) => {
	const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
	if (command === "build") assertProductionEnvironment(env);

	return {
		base: "./",
		plugins: [react()],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
		build: {
			target: "esnext",
		},
		optimizeDeps: {
			esbuildOptions: {
				target: "esnext",
			},
		},
	};
});
