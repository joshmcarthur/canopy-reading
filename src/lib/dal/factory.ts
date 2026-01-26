import type { StorageAdapter } from './adapter';
import { MemoryAdapter } from './adapters/memory';
import { FilesystemAdapter } from './adapters/filesystem';
import { CloudflareAdapter } from './adapters/cloudflare';

let adapterInstance: StorageAdapter | null = null;

/**
 * Get or create the storage adapter instance.
 * Adapter is selected based on CANOPY_STORAGE_ADAPTER environment variable.
 * 
 * For Cloudflare adapter, pass the Durable Object namespaces from the Astro context.
 */
export function getAdapter(options?: {
  branchDO?: DurableObjectNamespace;
  branchRegistryDO?: DurableObjectNamespace;
}): StorageAdapter {
  if (adapterInstance) {
    return adapterInstance;
  }

  const adapterType = process.env.CANOPY_STORAGE_ADAPTER || 'filesystem';

  switch (adapterType) {
    case 'memory':
      adapterInstance = new MemoryAdapter();
      break;

    case 'filesystem':
      adapterInstance = new FilesystemAdapter();
      break;

    case 'cloudflare':
      if (!options?.branchDO || !options?.branchRegistryDO) {
        throw new Error(
          'Cloudflare adapter requires branchDO and branchRegistryDO Durable Object namespaces. ' +
          'Make sure you are running in a Cloudflare Workers environment with proper bindings.'
        );
      }
      adapterInstance = new CloudflareAdapter({
        branchDO: options.branchDO,
        branchRegistryDO: options.branchRegistryDO,
      });
      break;

    default:
      throw new Error(
        `Unknown storage adapter: ${adapterType}. ` +
        `Supported adapters: memory, filesystem, cloudflare`
      );
  }

  return adapterInstance;
}

/**
 * Reset the adapter instance (useful for testing).
 */
export function resetAdapter(): void {
  adapterInstance = null;
}
