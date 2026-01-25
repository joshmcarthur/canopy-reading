import { describe, it, expect } from 'vitest';
import { projectBranchState } from '../src/domain/projection';
import type { AppEvent } from '../src/domain/types';

describe('Branch State Projection', () => {
  it('should initialize with empty state', () => {
    const events: AppEvent[] = [];
    const state = projectBranchState(events);
    expect(state.inbox).toEqual([]);
    expect(state.library).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it('should add generated recommendations to inbox', () => {
    const events: AppEvent[] = [
      {
        id: '1',
        timestamp: '2023-01-01T00:00:00Z',
        type: 'RECOMMENDATIONS_GENERATED',
        payload: {
          items: [
            { title: 'Book A', author: 'Author A', reason: 'Reason A' },
            { title: 'Book B', author: 'Author B', reason: 'Reason B' }
          ],
          model: 'gpt-4'
        }
      }
    ];

    const state = projectBranchState(events);
    expect(state.inbox).toHaveLength(2);
    expect(state.inbox[0].title).toBe('Book A');
    expect(state.inbox[0].status).toBe('PENDING');
    expect(state.library).toHaveLength(0);
  });

  it('should move accepted items to library', () => {
    const events: AppEvent[] = [
      {
        id: '1',
        timestamp: '2023-01-01T00:00:00Z',
        type: 'RECOMMENDATIONS_GENERATED',
        payload: {
          items: [
            { title: 'Book A', author: 'Author A', reason: 'Reason A' }
          ],
          model: 'gpt-4'
        }
      },
      {
        id: '2',
        timestamp: '2023-01-02T00:00:00Z',
        type: 'ITEM_STATUS_CHANGED',
        payload: {
          itemTitle: 'Book A',
          status: 'ACCEPTED'
        }
      }
    ];

    const state = projectBranchState(events);
    expect(state.inbox).toHaveLength(0);
    expect(state.library).toHaveLength(1);
    expect(state.library[0].title).toBe('Book A');
    expect(state.library[0].status).toBe('ACCEPTED');
  });

  it('should remove rejected items from inbox', () => {
    const events: AppEvent[] = [
      {
        id: '1',
        timestamp: '2023-01-01T00:00:00Z',
        type: 'RECOMMENDATIONS_GENERATED',
        payload: {
          items: [
            { title: 'Book A', author: 'Author A', reason: 'Reason A' }
          ],
          model: 'gpt-4'
        }
      },
      {
        id: '2',
        timestamp: '2023-01-02T00:00:00Z',
        type: 'ITEM_STATUS_CHANGED',
        payload: {
          itemTitle: 'Book A',
          status: 'REJECTED'
        }
      }
    ];

    const state = projectBranchState(events);
    expect(state.inbox).toHaveLength(0);
    expect(state.library).toHaveLength(0);
  });
});
