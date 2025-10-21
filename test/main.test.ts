import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertCdkOutputs } from "../src/main.js";

function normalizeNewlines(s: string): string {
	return s.replace(/\r\n/g, "\n");
}

describe("cdkoutputs2sh", () => {
	it("case1 matches expected outputs.sh", () => {
		const jsonPath = "test/data/case1/outputs.json";
		const expected = normalizeNewlines(readFileSync("test/data/case1/outputs.sh", "utf8")).trim();
		mkdirSync("var", { recursive: true });
		const tmpOut = "var/test_case1.sh";
		writeFileSync("var/outputs.json", readFileSync(jsonPath));
		const { exportBlock } = convertCdkOutputs({ input: "var/outputs.json", output: tmpOut }); // used for containment check
		const generated = normalizeNewlines(readFileSync(tmpOut, "utf8")).trim();
		// Ensure export block lines appear
		expect(generated).toContain(exportBlock.split("\n")[0]);
		// Compare variable lines ignoring ordering of comments beyond exports
		const expectedExports = expected
			.split("\n")
			.filter((l) => l.startsWith("export "))
			.sort()
			.join("\n");
		const generatedExports = generated
			.split("\n")
			.filter((l) => l.startsWith("export "))
			.sort()
			.join("\n");
		expect(generatedExports).toBe(expectedExports);
	});

	it("case2 matches expected outputs.sh", () => {
		const jsonPath = "test/data/case2/outputs.json";
		const expected = normalizeNewlines(readFileSync("test/data/case2/outputs.sh", "utf8")).trim();
		mkdirSync("var", { recursive: true });
		const tmpOut = "var/test_case2.sh";
		writeFileSync("var/outputs.json", readFileSync(jsonPath));
		const { exportBlock } = convertCdkOutputs({ input: "var/outputs.json", output: tmpOut });
		expect(exportBlock.length).toBeGreaterThan(0);
		const generated = normalizeNewlines(readFileSync(tmpOut, "utf8")).trim();
		const expectedExports = expected
			.split("\n")
			.filter((l) => l.startsWith("export "))
			.sort()
			.join("\n");
		const generatedExports = generated
			.split("\n")
			.filter((l) => l.startsWith("export "))
			.sort()
			.join("\n");
		expect(generatedExports).toBe(expectedExports);
	});
});
