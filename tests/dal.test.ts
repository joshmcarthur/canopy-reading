import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Unique temp dir for this test run
const TEST_DIR = path.join(os.tmpdir(), 'canopy-tests-' + Date.now());

describe('Data Access Layer', () => {
  beforeAll(async () => {
    // Set env var before importing the DAL
    process.env.CANOPY_DATA_DIR = TEST_DIR;
    await fs.mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it('should create and retrieve a branch', async () => {
    const { createBranch, getBranch, getAllBranches } = await import('../src/lib/dal/index');

    const branchName = 'Sci-Fi Classics';
    const description = 'Exploring the golden age of sci-fi.';

    const branch = await createBranch(branchName, description);

    expect(branch).toBeDefined();
    expect(branch.name).toBe(branchName);
    expect(branch.slug).toBe('sci-fi-classics');
    expect(branch.description).toBe(description);

    const fetchedBranch = await getBranch(branch.slug);
    expect(fetchedBranch).toEqual(branch);

    const allBranches = await getAllBranches();
    expect(allBranches).toHaveLength(1);
    expect(allBranches[0]).toEqual(branch);
  });

  it('should add and retrieve events', async () => {
    const { createBranch, addEvent, getBranchEvents } = await import('../src/lib/dal/index');
    
    // Create a new branch for this test to avoid conflicts if parallel execution (though here it's serial)
    const branch = await createBranch('Fantasy Worlds', 'Epic fantasy reading.');
    
    // Initial event should be there
    let events = await getBranchEvents(branch.slug);
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('BRANCH_CREATED');

    // Add a new event
    const eventId = 'test-event-id';
    await addEvent(branch.slug, {
      id: eventId,
      timestamp: new Date().toISOString(),
      type: 'RECOMMENDATIONS_REQUESTED',
      payload: { userNote: 'Looking for dragons.' }
    }, 'User asked for dragons.');

    events = await getBranchEvents(branch.slug);
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('RECOMMENDATIONS_REQUESTED');
    expect((events[1] as any).payload.userNote).toBe('Looking for dragons.');
  });
});
