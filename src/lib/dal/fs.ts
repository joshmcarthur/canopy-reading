import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { AppEvent, Branch } from "../../domain/types";

const DATA_DIR =
	process.env.CANOPY_DATA_DIR || path.join(process.cwd(), "data");
const BRANCHES_DIR = path.join(DATA_DIR, "branches");

export async function ensureDataDirs() {
	await fs.mkdir(BRANCHES_DIR, { recursive: true });
}

export async function ensureBranchDirectory(slug: string) {
	const branchDir = path.join(BRANCHES_DIR, slug);
	const eventsDir = path.join(branchDir, "events");
	await fs.mkdir(eventsDir, { recursive: true });
	return { branchDir, eventsDir };
}

export async function writeBranchMeta(slug: string, meta: Branch) {
	const { branchDir } = await ensureBranchDirectory(slug);
	await fs.writeFile(
		path.join(branchDir, "meta.json"),
		JSON.stringify(meta, null, 2),
		"utf-8",
	);
}

export async function readBranchMeta(slug: string): Promise<Branch | null> {
	const metaPath = path.join(BRANCHES_DIR, slug, "meta.json");
	try {
		const content = await fs.readFile(metaPath, "utf-8");
		return JSON.parse(content) as Branch;
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			return null;
		}
		throw error;
	}
}

export async function listBranches(): Promise<Branch[]> {
	await ensureDataDirs();
	const entries = await fs.readdir(BRANCHES_DIR, { withFileTypes: true });
	const slugs = entries
		.filter((ent) => ent.isDirectory())
		.map((ent) => ent.name);

	const branches: Branch[] = [];
	for (const slug of slugs) {
		const meta = await readBranchMeta(slug);
		if (meta) {
			branches.push(meta);
		}
	}
	return branches;
}

// Helper to format sequence number (e.g. 1 -> "001")
function formatSequence(seq: number): string {
	return seq.toString().padStart(3, "0");
}

export async function getNextEventSequence(slug: string): Promise<number> {
	const { eventsDir } = await ensureBranchDirectory(slug);
	const files = await fs.readdir(eventsDir);
	const eventFiles = files.filter((f) => f.endsWith(".md"));
	if (eventFiles.length === 0) return 1;

	const seqs = eventFiles.map((f) => Number.parseInt(f.split("-")[0], 10));
	return Math.max(0, ...seqs) + 1;
}

export async function appendEvent(
	slug: string,
	event: AppEvent,
	bodyContent = "",
) {
	const seq = await getNextEventSequence(slug);
	const seqStr = formatSequence(seq);
	// Convert event type to kebab case for filename
	const typeKebab = event.type.toLowerCase().replace(/_/g, "-");
	const filename = `${seqStr}-${typeKebab}.md`;

	const { eventsDir } = await ensureBranchDirectory(slug);
	const filePath = path.join(eventsDir, filename);

	const fileContent = matter.stringify(bodyContent, event);
	await fs.writeFile(filePath, fileContent, "utf-8");
}

export async function readEvents(slug: string): Promise<AppEvent[]> {
	const { eventsDir } = await ensureBranchDirectory(slug);
	const files = await fs.readdir(eventsDir);
	const eventFiles = files.filter((f) => f.endsWith(".md")).sort(); // Lexical sort works for "001-...", "002-..."

	const events: AppEvent[] = [];

	for (const file of eventFiles) {
		const filePath = path.join(eventsDir, file);
		const content = await fs.readFile(filePath, "utf-8");
		const parsed = matter(content);
		// TODO: Validate parsed.data against AppEvent schema?
		// For now assuming it matches. The payload is in the frontmatter.
		// Wait, the plan says "YAML frontmatter for machine-readable data and the Markdown body for human-readable content".
		// So the event fields (id, type, timestamp, payload) should be in frontmatter.

		// The `matter` function puts frontmatter in `parsed.data` and body in `parsed.content`.
		// The `event` object structure from `types.ts` has `payload` inside it.
		// If I just dump `event` into frontmatter, it will be `payload: ...`.

		events.push(parsed.data as AppEvent);
	}

	return events;
}
