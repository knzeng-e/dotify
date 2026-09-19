import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { assertProductionEnvironment } from "./src/shared/config/deploymentSafety";

function gitCommit(): string {
	try {
		return execFileSync("git", ["-C", __dirname, "rev-parse", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "unknown";
	}
}

export default defineConfig(({ command, mode }) => {
	const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
	if (command === "build") assertProductionEnvironment(env);
	const buildSha = String(env.VITE_DOTIFY_BUILD_SHA || "").trim() || gitCommit();

	return {
		base: "./",
		plugins: [react()],
		define: {
			"import.meta.env.VITE_DOTIFY_BUILD_SHA": JSON.stringify(buildSha),
		},
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
