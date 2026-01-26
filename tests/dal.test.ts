import { describe, it, expect, beforeAll } from 'vitest';
import { resetAdapter } from '../src/lib/dal/factory';

describe('Data Access Layer', () => {
  beforeAll(() => {
    // Use memory adapter for tests
    process.env.CANOPY_STORAGE_ADAPTER = 'memory';
    // Reset adapter to ensure clean state
    resetAdapter();
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
    });

    events = await getBranchEvents(branch.slug);
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe('RECOMMENDATIONS_REQUESTED');
    expect((events[1] as any).payload.userNote).toBe('Looking for dragons.');
  });
});
