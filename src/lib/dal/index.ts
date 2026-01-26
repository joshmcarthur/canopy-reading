import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import type { AppEvent, Branch, BranchCreatedEvent } from '../../domain/types';
import { getAdapter } from './factory';

/**
 * Initialize adapter with Cloudflare Durable Object bindings (if available).
 * Call this from Astro API routes/pages when running on Cloudflare.
 */
export function initializeAdapter(options?: {
  branchDO?: DurableObjectNamespace;
  branchRegistryDO?: DurableObjectNamespace;
}) {
  return getAdapter(options);
}

export async function createBranch(name: string, description: string): Promise<Branch> {
  const adapter = getAdapter();
  const slug = slugify(name, { lower: true, strict: true });
  const id = uuidv4();
  const timestamp = new Date().toISOString();

  const branch: Branch = {
    id,
    slug,
    name,
    description,
    createdAt: timestamp,
  };

  // 1. Write branch metadata
  await adapter.writeBranchMeta(slug, branch);

  // 2. Create BRANCH_CREATED event
  const event: BranchCreatedEvent = {
    id: uuidv4(),
    timestamp,
    type: 'BRANCH_CREATED',
    payload: {
      name,
      description,
    },
  };

  // 3. Append event
  await adapter.appendEvent(slug, event);

  return branch;
}

export async function getBranch(slug: string): Promise<Branch | null> {
  const adapter = getAdapter();
  return adapter.readBranchMeta(slug);
}

export async function getAllBranches(): Promise<Branch[]> {
  const adapter = getAdapter();
  return adapter.listBranches();
}

export async function getBranchEvents(slug: string): Promise<AppEvent[]> {
  const adapter = getAdapter();
  return adapter.readEvents(slug);
}

export async function addEvent(slug: string, event: AppEvent): Promise<void> {
  const adapter = getAdapter();
  return adapter.appendEvent(slug, event);
}
