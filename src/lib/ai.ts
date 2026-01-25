import OpenAI from 'openai';
import type { AppEvent, Branch, RecommendationItem } from '../domain/types';
import { projectBranchState } from '../domain/projection';

// Initialize OpenAI only if key is present
const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function generateRecommendations(
  branch: Branch,
  history: AppEvent[]
): Promise<RecommendationItem[]> {
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, returning mock recommendations.');
    return [
      {
        title: 'Mock Book 1',
        author: 'Mock Author 1',
        reason: 'Because you do not have an API key set.'
      },
      {
        title: 'Mock Book 2',
        author: 'Mock Author 2',
        reason: 'Another mock reason.'
      }
    ];
  }

  const state = projectBranchState(history);
  
  const systemPrompt = `You are a helpful reading assistant. 
  The user has a reading inquiry described as: "${branch.description}".
  
  Context:
  - Accepted Books: ${state.library.map(b => `${b.title} by ${b.author}`).join(', ')}
  - Rejected Books: ${history.filter(e => e.type === 'ITEM_STATUS_CHANGED' && e.payload.status === 'REJECTED').map(e => e.payload.itemTitle).join(', ')}
  
  Please suggest 3-5 relevant books.
  For each book, provide:
  - title
  - author
  - reason (a brief explanation of why it fits the inquiry)
  
  Respond in JSON format with a list of objects under the key "items".
  `;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Please provide recommendations.' }
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('No content received from AI');
  }

  const result = JSON.parse(content);
  return result.items as RecommendationItem[];
}
