import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import type { AppEvent, Branch, BranchCreatedEvent } from '../../domain/types';
import * as fsDal from './fs';

export async function createBranch(name: string, description: string): Promise<Branch> {
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

  // 1. Write meta.json
  await fsDal.writeBranchMeta(slug, branch);

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

  // 3. Write event file
  await fsDal.appendEvent(slug, event, `# Branch Created\n\n${description}`);

  return branch;
}

export async function getBranch(slug: string): Promise<Branch | null> {
  return fsDal.readBranchMeta(slug);
}

export async function getAllBranches(): Promise<Branch[]> {
  return fsDal.listBranches();
}

export async function getBranchEvents(slug: string): Promise<AppEvent[]> {
  return fsDal.readEvents(slug);
}

export async function addEvent(slug: string, event: AppEvent, bodyContent: string = '') {
  return fsDal.appendEvent(slug, event, bodyContent);
}
