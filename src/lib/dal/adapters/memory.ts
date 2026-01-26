import type { AppEvent, Branch } from "../../../domain/types";
import type { StorageAdapter } from "../adapter";

export class MemoryAdapter implements StorageAdapter {
	private branches = new Map<string, Branch>();
	private events = new Map<string, AppEvent[]>();

	async writeBranchMeta(slug: string, meta: Branch): Promise<void> {
		this.branches.set(slug, meta);
		// Initialize events array if it doesn't exist
		if (!this.events.has(slug)) {
			this.events.set(slug, []);
		}
	}

	async readBranchMeta(slug: string): Promise<Branch | null> {
		return this.branches.get(slug) || null;
	}

	async listBranches(): Promise<Branch[]> {
		return Array.from(this.branches.values());
	}

	async appendEvent(slug: string, event: AppEvent): Promise<void> {
		const branchEvents = this.events.get(slug) || [];
		branchEvents.push(event);
		this.events.set(slug, branchEvents);
	}

	async readEvents(slug: string): Promise<AppEvent[]> {
		return this.events.get(slug) || [];
	}

	/**
	 * Clear all data (useful for testing).
	 */
	clear(): void {
		this.branches.clear();
		this.events.clear();
	}
}
