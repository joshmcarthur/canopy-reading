import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { AppEvent, Branch, ReflectionAddedEvent } from "../../../domain/types";
import type { StorageAdapter } from "../adapter";

const DATA_DIR =
	process.env.CANOPY_DATA_DIR || path.join(process.cwd(), "data");
const BRANCHES_DIR = path.join(DATA_DIR, "branches");

export class FilesystemAdapter implements StorageAdapter {
	private async ensureDataDirs() {
		await fs.mkdir(BRANCHES_DIR, { recursive: true });
	}

	private async ensureBranchDirectory(slug: string) {
		const branchDir = path.join(BRANCHES_DIR, slug);
		const eventsDir = path.join(branchDir, "events");
		await fs.mkdir(eventsDir, { recursive: true });
		return { branchDir, eventsDir };
	}

	async writeBranchMeta(slug: string, meta: Branch): Promise<void> {
		const { branchDir } = await this.ensureBranchDirectory(slug);
		await fs.writeFile(
			path.join(branchDir, "meta.json"),
			JSON.stringify(meta, null, 2),
			"utf-8",
		);
	}

	async readBranchMeta(slug: string): Promise<Branch | null> {
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

	async listBranches(): Promise<Branch[]> {
		await this.ensureDataDirs();
		const entries = await fs.readdir(BRANCHES_DIR, { withFileTypes: true });
		const slugs = entries
			.filter((ent) => ent.isDirectory())
			.map((ent) => ent.name);

		const branches: Branch[] = [];
		for (const slug of slugs) {
			const meta = await this.readBranchMeta(slug);
			if (meta) {
				branches.push(meta);
			}
		}
		return branches;
	}

	async appendEvent(slug: string, event: AppEvent): Promise<void> {
		const { eventsDir } = await this.ensureBranchDirectory(slug);

		// Read existing events to determine next sequence number
		const files = await fs.readdir(eventsDir);
		const eventFiles = files.filter(
			(f) => f.endsWith(".json") || f.endsWith(".md"),
		);
		const nextSeq = eventFiles.length === 0 ? 1 : eventFiles.length + 1;

		// Format sequence number (e.g. 1 -> "001")
		const seqStr = nextSeq.toString().padStart(3, "0");
		const typeKebab = event.type.toLowerCase().replace(/_/g, "-");
		const filename = `${seqStr}-${typeKebab}-${event.id}.md`;
		const filePath = path.join(eventsDir, filename);

		let body = "";
		let frontmatter = { ...event };

		if (event.type === "REFLECTION_ADDED") {
			body = event.payload.content;
			// Create a payload without content for frontmatter to avoid duplication
			const { content, ...restPayload } = event.payload;
			frontmatter = {
				...event,
				payload: restPayload,
			} as any;
		}

		await fs.writeFile(filePath, matter.stringify(body, frontmatter), "utf-8");
	}

	async readEvents(slug: string): Promise<AppEvent[]> {
		const { eventsDir } = await this.ensureBranchDirectory(slug);

		try {
			const files = await fs.readdir(eventsDir);
			// Lexical sort works for "001-...", "002-..."
			const eventFiles = files
				.filter((f) => f.endsWith(".json") || f.endsWith(".md"))
				.sort();

			const events: AppEvent[] = [];

			for (const file of eventFiles) {
				const filePath = path.join(eventsDir, file);
				const content = await fs.readFile(filePath, "utf-8");

				if (file.endsWith(".json")) {
					events.push(JSON.parse(content) as AppEvent);
				} else if (file.endsWith(".md")) {
					const parsed = matter(content);
					const event = parsed.data as AppEvent;

					if (event.type === "REFLECTION_ADDED") {
						// Restore content from body
						(event as ReflectionAddedEvent).payload.content =
							parsed.content.trim();
					}
					events.push(event);
				}
			}

			return events;
		} catch (error) {
			if (
				error &&
				typeof error === "object" &&
				"code" in error &&
				error.code === "ENOENT"
			) {
				return [];
			}
			throw error;
		}
	}
}
