#!/usr/bin/env node
/**
 * Convert AWS CDK deploy --outputs-file JSON (default: var/outputs.json)
 * into a shell script exporting environment variables (default: var/outputs.sh).
 *
 * Usage (after building):
 *   node dist/cdkoutputs2sh.js --input var/outputs.json --output var/outputs.sh
 * Or via package bin:
 *   cdkoutputs2sh --input var/outputs.json --output var/outputs.sh
 *
 * If no arguments are provided, defaults are used.
 *
 * The generated file contains export statements and comment lines mapping the
 * environment variable names back to the original stack output keys. Non-scalar
 * values (objects/arrays) are skipped with a warning. Name collisions cause an error.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface Options {
	input: string;
	output: string;
	failOnMissing: boolean;
	verbose: number;
}

function parseArgs(argv: string[]): Options {
	const opts: Options = {
		input: "var/outputs.json",
		output: "var/outputs.sh",
		failOnMissing: false,
		verbose: 0,
	};
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--input" || a === "-i") {
			opts.input = argv[++i] ?? opts.input;
		} else if (a === "--output" || a === "-o") {
			opts.output = argv[++i] ?? opts.output;
		} else if (a === "--fail-on-missing") {
			opts.failOnMissing = true;
		} else if (a === "--verbose" || a === "-v") {
			opts.verbose += 1;
		} else if (a === "-vv") {
			opts.verbose = 2;
		} else if (a === "--help" || a === "-h") {
			console.log(
				"Usage: cdkoutputs2sh [--input file] [--output file] [--fail-on-missing] [-v|-vv]\n",
			);
			process.exit(0);
		}
	}
	return opts;
}

function log(level: "DEBUG" | "INFO" | "WARN" | "ERROR", msg: string, verbose: number): void {
	if (level === "DEBUG" && verbose < 2) return;
	if (level === "INFO" && verbose < 1) return;
	// WARN & ERROR always print
	const prefix = level === "ERROR" ? "ERROR" : level === "WARN" ? "WARN" : level;
	console.error(`${prefix}: ${msg}`);
}

function loadJson(path: string): Record<string, unknown> {
	if (!existsSync(path)) {
		throw new Error(`Input JSON not found: ${path}`);
	}
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		throw new Error(`Failed to read ${path}: ${err.message}`);
	}
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		throw new Error(`Invalid JSON in ${path}: ${err.message}`);
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error("Top-level JSON must be an object");
	}
	return data as Record<string, unknown>;
}

function sanitizeVarName(stack: string, key: string): string {
	let base = `${stack}_${key}`.toUpperCase();
	base = base.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
	// Additional rule from sample outputs: if original stack starts with 'Cdk'
	// then prefix the variable name with 'CDK_'. (Case-sensitive match to sample.)
	if (stack.startsWith("Cdk") && !base.startsWith("CDK_")) {
		base = `CDK_${base}`;
	}
	if (!base) throw new Error(`Could not derive variable name from ${stack}.${key}`);
	if (/^[0-9]/.test(base)) base = `V_${base}`;
	return base;
}

// Single-quote shell quoting, escaping existing single quotes
function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

interface ExportItem {
	stack: string;
	key: string;
	varName: string;
	value: unknown;
}

function iterExports(data: Record<string, unknown>, verbose: number): ExportItem[] {
	const items: ExportItem[] = [];
	for (const [stack, outputs] of Object.entries(data)) {
		if (typeof outputs !== "object" || outputs === null || Array.isArray(outputs)) {
			log("WARN", `Skipping stack ${stack}: expected object, got ${String(outputs)}`, verbose);
			continue;
		}
		for (const [key, value] of Object.entries(outputs as Record<string, unknown>)) {
			if (value !== null && typeof value === "object") {
				log(
					"WARN",
					`Skipping non-scalar output ${stack}.${key} (type=${Array.isArray(value) ? "array" : typeof value})`,
					verbose,
				);
				continue;
			}
			const varName = sanitizeVarName(stack, key);
			items.push({ stack, key, varName, value });
		}
	}
	return items;
}

function buildExportLines(
	data: Record<string, unknown>,
	verbose: number,
): { exportBlock: string; mapping: Record<string, string> } {
	const lines: string[] = [];
	const used: Record<string, string> = {};
	const collisions: Record<string, string[]> = {};
	for (const item of iterExports(data, verbose)) {
		const orig = `${item.stack}.${item.key}`;
		if (used[item.varName]) {
			const first = used[item.varName];
			let arr = collisions[item.varName];
			if (!arr) {
				arr = first ? [first] : [];
				collisions[item.varName] = arr;
			}
			arr.push(orig);
			continue;
		}
		used[item.varName] = orig;
		const valStr = item.value == null ? "" : String(item.value);
		lines.push(`export ${item.varName}=${shellQuote(valStr)}`);
	}
	if (Object.keys(collisions).length) {
		for (const [varName, origins] of Object.entries(collisions)) {
			log("ERROR", `Name collision for ${varName} from: ${origins.join(", ")}`, verbose);
		}
		throw new Error("Variable name collisions detected. Adjust output keys.");
	}
	return { exportBlock: lines.sort().join("\n"), mapping: used };
}

function writeShell(path: string, exportBlock: string, mapping: Record<string, string>): void {
	mkdirSync(dirname(path), { recursive: true });
	const headerLines: string[] = [
		"#!/usr/bin/env bash",
		"# Generated from AWS CDK outputs JSON. Do not edit manually.",
		"# shellcheck disable=SC2034",
		"# Source this file:",
		"#   source var/outputs.sh",
	];
	const commentMap = Object.entries(mapping)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([varName, origin]) => `# ${varName} <= ${origin}`);
	const content = [...headerLines, ...commentMap, "", exportBlock, ""].join("\n");
	writeFileSync(path, content, { encoding: "utf8" });
	chmodSync(path, 0o644);
}

export function convertCdkOutputs(options?: Partial<Options>): {
	exportBlock: string;
	mapping: Record<string, string>;
} {
	const opts = {
		input: "var/outputs.json",
		output: "var/outputs.sh",
		failOnMissing: false,
		verbose: 0,
		...options,
	};
	let data: Record<string, unknown>;
	try {
		data = loadJson(opts.input);
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		if (err.message.startsWith("Input JSON not found") && !opts.failOnMissing) {
			return { exportBlock: "", mapping: {} };
		}
		throw err;
	}
	const { exportBlock, mapping } = buildExportLines(data, opts.verbose);
	writeShell(opts.output, exportBlock, mapping);
	return { exportBlock, mapping };
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const opts = parseArgs(process.argv.slice(2));
	try {
		const { mapping } = convertCdkOutputs(opts);
		log("INFO", `Wrote ${Object.keys(mapping).length} exports to ${opts.output}`, opts.verbose);
	} catch (e) {
		const err = e instanceof Error ? e : new Error(String(e));
		log("ERROR", err.message, opts.verbose);
		process.exit(1);
	}
}
