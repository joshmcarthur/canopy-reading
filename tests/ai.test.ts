import { describe, it, expect } from 'vitest';
import { generateRecommendations } from '../src/lib/ai';
import type { Branch, AppEvent } from '../src/domain/types';

describe('AI Integration', () => {
  it('should return mock recommendations when API key is missing', async () => {
    const branch: Branch = {
      id: '1',
      slug: 'test-branch',
      name: 'Test Branch',
      description: 'Test Description',
      createdAt: new Date().toISOString()
    };
    const history: AppEvent[] = [];

    // Ensure API Key is unset
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
        const items = await generateRecommendations(branch, history);
        expect(items).toHaveLength(2);
        expect(items[0].title).toContain('Mock');
    } finally {
        // Restore key if it was set (though in test env it usually isn't unless configured)
        if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
