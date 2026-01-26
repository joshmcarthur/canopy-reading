import type { AppEvent, Branch } from "../domain/types";

export interface Env {
	BRANCH_DO: DurableObjectNamespace<BranchDO>;
}

export class BranchDO {
	private state: DurableObjectState;
	private env: Env;
	private branch: Branch | null = null;
	private events: AppEvent[] = [];

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		// Load state from storage
		await this.loadState();

		if (request.method === "GET") {
			if (path.endsWith("/meta")) {
				return new Response(JSON.stringify(this.branch), {
					headers: { "Content-Type": "application/json" },
				});
			}
			if (path.endsWith("/events")) {
				return new Response(JSON.stringify(this.events), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Not found", { status: 404 });
		}

		if (request.method === "POST") {
			if (path.endsWith("/meta")) {
				const branch = (await request.json()) as Branch;
				this.branch = branch;
				await this.saveState();
				return new Response(JSON.stringify(branch), {
					headers: { "Content-Type": "application/json" },
				});
			}
			if (path.endsWith("/events")) {
				const event = (await request.json()) as AppEvent;
				this.events.push(event);
				await this.saveState();
				return new Response(JSON.stringify(event), {
					headers: { "Content-Type": "application/json" },
				});
			}
			return new Response("Not found", { status: 404 });
		}

		return new Response("Method not allowed", { status: 405 });
	}

	private async loadState(): Promise<void> {
		const stored = await this.state.storage.get<{
			branch: Branch | null;
			events: AppEvent[];
		}>("state");
		if (stored) {
			this.branch = stored.branch;
			this.events = stored.events || [];
		}
	}

	private async saveState(): Promise<void> {
		await this.state.storage.put("state", {
			branch: this.branch,
			events: this.events,
		});
	}
}
