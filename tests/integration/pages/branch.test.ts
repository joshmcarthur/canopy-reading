import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage, createTestBranch, createRecommendationsGeneratedEvent, createStatusChangedEvent, createMockRecommendation } from '../helpers';
import { getBranch, getBranchEvents } from '../../../src/lib/dal';
import { projectBranchState } from '../../../src/domain/projection';

// Test pages by testing the data they fetch and display
// This is simpler than using Container API which requires renderer configuration
describe('Branch Page Integration', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('should fetch branch data correctly', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch description');

    const fetchedBranch = await getBranch(branch.slug);
    expect(fetchedBranch).toBeDefined();
    expect(fetchedBranch?.name).toBe('Test Branch');
    expect(fetchedBranch?.description).toBe('A test branch description');
  });

  it('should handle missing branch gracefully', async () => {
    const branch = await getBranch('nonexistent-branch');
    expect(branch).toBeNull();
  });

  it('should display empty shelf when no books', async () => {
    const branch = await createTestBranch('Empty Branch', 'No books yet');

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    expect(state.library).toHaveLength(0);
    expect(state.inbox).toHaveLength(0);
  });

  it('should display to-read books correctly', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');
    
    const recommendations = [
      createMockRecommendation('Book A', 'Author A', 'Reason A'),
      createMockRecommendation('Book B', 'Author B', 'Reason B'),
    ];
    
    const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
    const acceptedEvent1 = createStatusChangedEvent('Book A', 'ACCEPTED');
    const acceptedEvent2 = createStatusChangedEvent('Book B', 'ACCEPTED');
    
    await createTestBranch(branch.name, branch.description, [
      generatedEvent,
      acceptedEvent1,
      acceptedEvent2,
    ]);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    const toRead = state.library.filter(i => i.status === 'ACCEPTED' || i.status === 'DEFERRED');
    expect(toRead).toHaveLength(2);
    expect(toRead.some(b => b.title === 'Book A')).toBe(true);
    expect(toRead.some(b => b.title === 'Book B')).toBe(true);
  });

  it('should display read books correctly', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');
    
    const recommendations = [
      createMockRecommendation('Read Book', 'Author', 'Reason'),
    ];
    
    const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
    const readEvent = createStatusChangedEvent('Read Book', 'ALREADY_READ');
    
    await createTestBranch(branch.name, branch.description, [
      generatedEvent,
      readEvent,
    ]);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    const read = state.library.filter(i => i.status === 'ALREADY_READ');
    expect(read).toHaveLength(1);
    expect(read[0].title).toBe('Read Book');
  });

  it('should display recommendations sidebar correctly', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');
    
    const recommendations = [
      createMockRecommendation('Recommendation 1', 'Author 1', 'Reason 1'),
      createMockRecommendation('Recommendation 2', 'Author 2', 'Reason 2'),
    ];
    
    const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
    await createTestBranch(branch.name, branch.description, [generatedEvent]);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    expect(state.inbox).toHaveLength(2);
    expect(state.inbox.some(b => b.title === 'Recommendation 1')).toBe(true);
    expect(state.inbox.some(b => b.title === 'Recommendation 2')).toBe(true);
  });

  it('should display empty recommendations when none exist', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    expect(state.inbox).toHaveLength(0);
  });
});
