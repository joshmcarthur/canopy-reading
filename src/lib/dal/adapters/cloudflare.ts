import type { AppEvent, Branch } from "../../../domain/types";
import type { StorageAdapter } from "../adapter";

export interface CloudflareAdapterOptions {
	branchDO: DurableObjectNamespace;
	branchRegistryDO: DurableObjectNamespace;
}

export class CloudflareAdapter implements StorageAdapter {
	private branchDO: DurableObjectNamespace;
	private branchRegistryDO: DurableObjectNamespace;

	constructor(options: CloudflareAdapterOptions) {
		this.branchDO = options.branchDO;
		this.branchRegistryDO = options.branchRegistryDO;
	}

	private getBranchDOId(slug: string): DurableObjectId {
		// Use slug as the DO ID
		return this.branchDO.idFromName(slug);
	}

	private getBranchRegistryDOId(): DurableObjectId {
		// Single registry DO
		return this.branchRegistryDO.idFromName("registry");
	}

	private async getBranchDOStub(slug: string): Promise<DurableObjectStub> {
		const id = this.getBranchDOId(slug);
		return this.branchDO.get(id);
	}

	private async getBranchRegistryDOStub(): Promise<DurableObjectStub> {
		const id = this.getBranchRegistryDOId();
		return this.branchRegistryDO.get(id);
	}

	async writeBranchMeta(slug: string, meta: Branch): Promise<void> {
		const stub = await this.getBranchDOStub(slug);
		await stub.fetch(
			new Request("https://branch.local/meta", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(meta),
			}),
		);

		// Also register in registry
		const registryStub = await this.getBranchRegistryDOStub();
		await registryStub.fetch(
			new Request("https://registry.local/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(meta),
			}),
		);
	}

	async readBranchMeta(slug: string): Promise<Branch | null> {
		const stub = await this.getBranchDOStub(slug);
		const response = await stub.fetch(new Request("https://branch.local/meta"));

		if (response.status === 404) {
			return null;
		}

		return (await response.json()) as Branch;
	}

	async listBranches(): Promise<Branch[]> {
		const registryStub = await this.getBranchRegistryDOStub();
		const response = await registryStub.fetch(
			new Request("https://registry.local/list"),
		);

		if (response.status === 404) {
			return [];
		}

		return (await response.json()) as Branch[];
	}

	async appendEvent(slug: string, event: AppEvent): Promise<void> {
		const stub = await this.getBranchDOStub(slug);
		await stub.fetch(
			new Request("https://branch.local/events", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(event),
			}),
		);
	}

	async readEvents(slug: string): Promise<AppEvent[]> {
		const stub = await this.getBranchDOStub(slug);
		const response = await stub.fetch(
			new Request("https://branch.local/events"),
		);

		if (response.status === 404) {
			return [];
		}

		return (await response.json()) as AppEvent[];
	}
}
