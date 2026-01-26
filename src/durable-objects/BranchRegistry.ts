import type { Branch } from "../domain/types";

export interface Env {
	BRANCH_REGISTRY_DO: DurableObjectNamespace<BranchRegistryDO>;
}

export class BranchRegistryDO {
	private state: DurableObjectState;
	private env: Env;
	private branches: Map<string, Branch> = new Map();

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		// Load state from storage
		await this.loadState();

		if (request.method === "GET") {
			const url = new URL(request.url);
			if (url.pathname.endsWith("/list")) {
				const branches = Array.from(this.branches.values());
				return new Response(JSON.stringify(branches), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Not found", { status: 404 });
		}

		if (request.method === "POST") {
			const url = new URL(request.url);
			if (url.pathname.endsWith("/register")) {
				const branch = (await request.json()) as Branch;
				this.branches.set(branch.slug, branch);
				await this.saveState();
				return new Response(JSON.stringify(branch), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Not found", { status: 404 });
		}

		return new Response("Method not allowed", { status: 405 });
	}

	private async loadState(): Promise<void> {
		const stored =
			await this.state.storage.get<Record<string, Branch>>("branches");
		if (stored) {
			this.branches = new Map(Object.entries(stored));
		}
	}

	private async saveState(): Promise<void> {
		const branchesObj = Object.fromEntries(this.branches);
		await this.state.storage.put("branches", branchesObj);
	}
}
