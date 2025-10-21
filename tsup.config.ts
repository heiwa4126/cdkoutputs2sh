import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/main.ts"],
	format: ["esm"],
	outDir: "dist",
	bundle: false,
	splitting: false,
	sourcemap: false,
	minify: true,
	clean: true,
	dts: {
		resolve: true,
		entry: ["src/main.ts"],
	},
});
