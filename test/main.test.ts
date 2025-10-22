import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertCdkOutputs } from "../src/main.js";

function normalizeNewlines(s: string): string {
	return s.replace(/\r\n/g, "\n");
}

/**
 * Test helper function to validate CDK outputs conversion
 * @param caseNumber - Test case number (e.g., "case1", "case2")
 * @param options - Additional test options
 */
function testCdkOutputsConversion(
	caseNumber: string,
	options: { checkContainment?: boolean } = {},
) {
	const jsonPath = `test/data/${caseNumber}/outputs.json`;
	const expectedPath = `test/data/${caseNumber}/outputs.sh`;
	const tmpOut = `var/test_${caseNumber}.sh`;

	// Read expected output
	const expected = normalizeNewlines(readFileSync(expectedPath, "utf8")).trim();

	// Setup test environment
	mkdirSync("var", { recursive: true });
	writeFileSync("var/outputs.json", readFileSync(jsonPath));

	// Convert CDK outputs
	const { exportBlock } = convertCdkOutputs({ input: "var/outputs.json", output: tmpOut });

	// Read generated output
	const generated = normalizeNewlines(readFileSync(tmpOut, "utf8")).trim();

	// Optional containment check
	if (options.checkContainment) {
		expect(generated).toContain(exportBlock.split("\n")[0]);
	}

	// Ensure export block is not empty
	expect(exportBlock.length).toBeGreaterThan(0);

	// Compare export lines (ignoring order and comments)
	const expectedExports = expected
		.split("\n")
		.filter((line) => line.startsWith("export "))
		.sort()
		.join("\n");

	const generatedExports = generated
		.split("\n")
		.filter((line) => line.startsWith("export "))
		.sort()
		.join("\n");

	expect(generatedExports).toBe(expectedExports);
}

describe("cdkoutputs2sh", () => {
	it("case1 matches expected outputs.sh", () => {
		testCdkOutputsConversion("case1", { checkContainment: true });
	});

	it("case2 matches expected outputs.sh", () => {
		testCdkOutputsConversion("case2");
	});
});
