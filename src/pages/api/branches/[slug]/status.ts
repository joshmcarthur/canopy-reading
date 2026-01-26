import type { APIRoute } from 'astro';
import { addEvent, getBranchEvents, getBranch } from '../../../../lib/dal';
import { projectBranchState } from '../../../../domain/projection';
import { generateRecommendations } from '../../../../lib/ai';
import { v4 as uuidv4 } from 'uuid';
import type { ItemStatus } from '../../../../domain/types';

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  const formData = await request.formData();
  const itemTitle = formData.get('itemTitle')?.toString();
  const status = formData.get('status')?.toString() as ItemStatus;

  if (!itemTitle || !status) {
    return new Response('Missing itemTitle or status', { status: 400 });
  }

  await addEvent(slug, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'ITEM_STATUS_CHANGED',
      payload: {
          itemTitle,
          status
      }
  }, `User changed status of "**${itemTitle}**" to \`${status}\``);

  // Auto-generation logic
  // Check if we need to replenish recommendations
  // We do this asynchronously (fire and forget logic similar to generate.ts)
  (async () => {
    try {
      const events = await getBranchEvents(slug);
      const state = projectBranchState(events);
      
      // If inbox is running low (e.g., fewer than 2 items), generate more
      // Also check if we haven't just generated recently to avoid loops (though the inbox count check helps)
      if (state.inbox.length < 2) {
        console.log(`Inbox low (${state.inbox.length} items) for branch ${slug}, auto-generating...`);
        
        const branch = await getBranch(slug);
        if (branch) {
          // Add REQUESTED event (system initiated)
          await addEvent(slug, {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              type: 'RECOMMENDATIONS_REQUESTED',
              payload: { userNote: 'Auto-generated due to low inbox' }
          }, 'System auto-requested recommendations.');

          const items = await generateRecommendations(branch, events);
          
          await addEvent(slug, {
              id: uuidv4(),
              timestamp: new Date().toISOString(),
              type: 'RECOMMENDATIONS_GENERATED',
              payload: {
                  items,
                  model: 'gpt-4o'
              }
          }, `# Recommendations Generated (Auto)\n\n${items.map(i => `- **${i.title}** by ${i.author}: ${i.reason}`).join('\n')}`);
        }
      }
    } catch (error) {
      console.error('Error in auto-generation:', error);
    }
  })();

  return redirect(`/branch/${slug}`);
};
