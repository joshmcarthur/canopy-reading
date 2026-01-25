import type { APIRoute } from 'astro';
import { getBranch, getBranchEvents, addEvent } from '../../../../lib/dal';
import { generateRecommendations } from '../../../../lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const POST: APIRoute = async ({ params, redirect }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  const branch = await getBranch(slug);
  if (!branch) return new Response('Branch not found', { status: 404 });

  const events = await getBranchEvents(slug);
  
  // Add REQUESTED event
  await addEvent(slug, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'RECOMMENDATIONS_REQUESTED',
      payload: {}
  }, 'User requested recommendations.');

  try {
    const items = await generateRecommendations(branch, events);
    
    // Add GENERATED event
    await addEvent(slug, {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        type: 'RECOMMENDATIONS_GENERATED',
        payload: {
            items,
            model: 'gpt-4o'
        }
    }, `# Recommendations Generated\n\n${items.map(i => `- **${i.title}** by ${i.author}: ${i.reason}`).join('\n')}`);

    return redirect(`/branch/${slug}`);
  } catch (error) {
    console.error(error);
    return new Response('Error generating recommendations', { status: 500 });
  }
};
