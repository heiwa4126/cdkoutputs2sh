import { defineConfig } from "tsdown";

function fixCjsExtension({ format }: { format: string }) {
	if (format === "cjs") return { js: ".cjs" };
	return { js: ".js" };
}

export default defineConfig([
	{
		clean: true,
		entry: ["src/main.ts"],
		format: ["esm", "cjs"],
		outDir: "dist",
		unbundle: true,
		sourcemap: false,
		minify: false,
		dts: true,
		outExtensions: fixCjsExtension,
	},
]);
