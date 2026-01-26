import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Branch, AppEvent, ReflectionAddedEvent } from '../src/domain/types';

// Mock OpenAI module
const mockChatCompletionsCreate = vi.fn();
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockChatCompletionsCreate
        }
      }
    }))
  };
});

describe('AI Integration', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    // Reset mock before each test
    mockChatCompletionsCreate.mockReset();
    mockChatCompletionsCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            items: [
              { title: 'Test Book', author: 'Test Author', reason: 'Test reason', isbn: '1234567890' }
            ]
          })
        }
      }]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('should return mock recommendations when API key is missing', async () => {
    // Import after mocking OpenAI
    const { generateRecommendations } = await import('../src/lib/ai');
    
    const branch: Branch = {
      id: '1',
      slug: 'test-branch',
      name: 'Test Branch',
      description: 'Test Description',
      createdAt: new Date().toISOString()
    };
    const history: AppEvent[] = [];

    // Ensure API Key is unset
    delete process.env.OPENAI_API_KEY;

    const items = await generateRecommendations(branch, history);
    expect(items).toHaveLength(2);
    expect(items[0].title).toContain('Mock');
  });

  describe('Reflections in AI prompt', () => {
    const branch: Branch = {
      id: '1',
      slug: 'test-branch',
      name: 'Test Branch',
      description: 'Test Description',
      createdAt: new Date().toISOString()
    };

    beforeEach(async () => {
      // Set API key so we test the actual OpenAI path
      process.env.OPENAI_API_KEY = 'test-key';
      // Reset modules to ensure the API key is picked up
      await vi.resetModules();
    });

    it('should include "None yet." when no reflections exist', async () => {
      const { generateRecommendations } = await import('../src/lib/ai');
      const history: AppEvent[] = [];

      await generateRecommendations(branch, history);

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      
      expect(systemPrompt).toContain('User Reflections: None yet.');
    });

    it('should include branch-level reflection in prompt', async () => {
      const { generateRecommendations } = await import('../src/lib/ai');
      const reflection: ReflectionAddedEvent = {
        id: 'ref-1',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          content: 'I love historical fiction with strong female protagonists'
        }
      };
      const history: AppEvent[] = [reflection];

      await generateRecommendations(branch, history);

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      
      expect(systemPrompt).toContain('User Reflections:');
      expect(systemPrompt).toContain('I love historical fiction with strong female protagonists');
      expect(systemPrompt).not.toContain('On "');
    });

    it('should include book-specific reflection in prompt with book title', async () => {
      const { generateRecommendations } = await import('../src/lib/ai');
      const reflection: ReflectionAddedEvent = {
        id: 'ref-1',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          itemTitle: 'The Test Book',
          content: 'This book had amazing character development'
        }
      };
      const history: AppEvent[] = [reflection];

      await generateRecommendations(branch, history);

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      
      expect(systemPrompt).toContain('User Reflections:');
      expect(systemPrompt).toContain('On "The Test Book": This book had amazing character development');
    });

    it('should include multiple reflections in prompt', async () => {
      const { generateRecommendations } = await import('../src/lib/ai');
      const reflection1: ReflectionAddedEvent = {
        id: 'ref-1',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          content: 'I prefer shorter books'
        }
      };
      const reflection2: ReflectionAddedEvent = {
        id: 'ref-2',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          itemTitle: 'Book A',
          content: 'Great pacing'
        }
      };
      const reflection3: ReflectionAddedEvent = {
        id: 'ref-3',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          itemTitle: 'Book B',
          content: 'Too slow for my taste'
        }
      };
      const history: AppEvent[] = [reflection1, reflection2, reflection3];

      await generateRecommendations(branch, history);

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      
      expect(systemPrompt).toContain('User Reflections:');
      expect(systemPrompt).toContain('I prefer shorter books');
      expect(systemPrompt).toContain('On "Book A": Great pacing');
      expect(systemPrompt).toContain('On "Book B": Too slow for my taste');
    });

    it('should filter out non-reflection events when extracting reflections', async () => {
      const { generateRecommendations } = await import('../src/lib/ai');
      const reflection: ReflectionAddedEvent = {
        id: 'ref-1',
        timestamp: new Date().toISOString(),
        type: 'REFLECTION_ADDED',
        payload: {
          content: 'Only this reflection should appear'
        }
      };
      const otherEvent: AppEvent = {
        id: 'other-1',
        timestamp: new Date().toISOString(),
        type: 'RECOMMENDATIONS_REQUESTED',
        payload: {}
      };
      const history: AppEvent[] = [reflection, otherEvent];

      await generateRecommendations(branch, history);

      expect(mockChatCompletionsCreate).toHaveBeenCalled();
      const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
      const systemPrompt = callArgs.messages.find((m: any) => m.role === 'system')?.content;
      
      expect(systemPrompt).toContain('Only this reflection should appear');
      expect(systemPrompt).not.toContain('RECOMMENDATIONS_REQUESTED');
    });
  });
});
