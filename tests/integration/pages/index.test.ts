import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage, createTestBranch, createRecommendationsGeneratedEvent, createStatusChangedEvent, createMockRecommendation } from '../helpers';
import { getAllBranches, getBranchEvents } from '../../../src/lib/dal';
import { projectBranchState } from '../../../src/domain/projection';

// Test index page by testing the data it fetches and displays
describe('Index Page Integration', () => {
  beforeEach(() => {
    resetStorage();
  });

  it('should return empty branches list when none exist', async () => {
    const branches = await getAllBranches();
    expect(branches).toHaveLength(0);
  });

  it('should return all branches', async () => {
    const branch1 = await createTestBranch('History of Coffee', 'Learning about coffee');
    const branch2 = await createTestBranch('Science Fiction', 'Exploring sci-fi');

    const branches = await getAllBranches();
    expect(branches.length).toBeGreaterThanOrEqual(2);
    expect(branches.some(b => b.name === 'History of Coffee')).toBe(true);
    expect(branches.some(b => b.name === 'Science Fiction')).toBe(true);
  });

  it('should calculate branch state with book counts', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');
    
    const recommendations = [
      createMockRecommendation('Book 1', 'Author 1', 'Reason 1'),
      createMockRecommendation('Book 2', 'Author 2', 'Reason 2'),
      createMockRecommendation('Book 3', 'Author 3', 'Reason 3'),
    ];
    
    const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
    const acceptedEvent = createStatusChangedEvent('Book 1', 'ACCEPTED');
    const readEvent = createStatusChangedEvent('Book 2', 'ALREADY_READ');
    
    await createTestBranch(branch.name, branch.description, [
      generatedEvent,
      acceptedEvent,
      readEvent,
    ]);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    const toRead = state.library.filter(i => i.status === 'ACCEPTED' || i.status === 'DEFERRED');
    const read = state.library.filter(i => i.status === 'ALREADY_READ');
    
    expect(toRead.length).toBeGreaterThan(0);
    expect(read.length).toBeGreaterThan(0);
  });

  it('should include book covers in branch state', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');
    
    const recommendations = [
      createMockRecommendation('Book 1', 'Author 1', 'Reason 1', {
        coverImageUrl: 'https://example.com/cover1.jpg',
      }),
      createMockRecommendation('Book 2', 'Author 2', 'Reason 2', {
        coverImageUrl: 'https://example.com/cover2.jpg',
      }),
    ];
    
    const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
    const acceptedEvent1 = createStatusChangedEvent('Book 1', 'ACCEPTED');
    const acceptedEvent2 = createStatusChangedEvent('Book 2', 'ACCEPTED');
    
    await createTestBranch(branch.name, branch.description, [
      generatedEvent,
      acceptedEvent1,
      acceptedEvent2,
    ]);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    
    const booksWithCovers = [...state.library, ...state.inbox].filter(
      item => item.metadata?.coverImageUrl
    );
    expect(booksWithCovers.length).toBeGreaterThan(0);
    expect(booksWithCovers.some(b => b.metadata?.coverImageUrl?.includes('cover1.jpg'))).toBe(true);
  });
});
