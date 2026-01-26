import type { APIRoute } from 'astro';
import { getBranchEvents } from '../../../../lib/dal';
import { projectBranchState } from '../../../../domain/projection';

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  try {
    const events = await getBranchEvents(slug);
    const state = projectBranchState(events);
    
    return new Response(JSON.stringify({
      inbox: state.inbox,
      library: state.library,
      historyCount: state.history.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Failed to fetch state' }), { status: 500 });
  }
};
