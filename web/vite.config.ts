import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

import { assertProductionEnvironment } from "./src/shared/config/deploymentSafety";
import { assertCleanEvidenceBuild, readGitBuildIdentity } from "./scripts/build-identity.mjs";

export default defineConfig(({ command, mode }) => {
	const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
	if (command === "build") assertProductionEnvironment(env);
	const gitIdentity = readGitBuildIdentity(__dirname);
	assertCleanEvidenceBuild(command, env, gitIdentity);
	const buildSha = String(env.VITE_DOTIFY_BUILD_SHA || "").trim() || gitIdentity.gitSha;
	const buildClean = command === "serve" && env.VITE_E2E_READINESS_PANEL === "true" ? true : gitIdentity.clean;

	return {
		base: "./",
		plugins: [react()],
		define: {
			"import.meta.env.VITE_DOTIFY_BUILD_SHA": JSON.stringify(buildSha),
			"import.meta.env.VITE_DOTIFY_BUILD_CLEAN": JSON.stringify(String(buildClean)),
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
