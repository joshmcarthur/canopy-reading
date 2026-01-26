import type { AppEvent, Branch } from '../../domain/types';

/**
 * Adapter interface for storage backends.
 * All storage adapters must implement this interface.
 */
export interface StorageAdapter {
  /**
   * Write branch metadata.
   */
  writeBranchMeta(slug: string, meta: Branch): Promise<void>;

  /**
   * Read branch metadata by slug.
   */
  readBranchMeta(slug: string): Promise<Branch | null>;

  /**
   * List all branches.
   */
  listBranches(): Promise<Branch[]>;

  /**
   * Append an event to a branch's event stream.
   */
  appendEvent(slug: string, event: AppEvent): Promise<void>;

  /**
   * Read all events for a branch, in chronological order.
   */
  readEvents(slug: string): Promise<AppEvent[]>;
}
