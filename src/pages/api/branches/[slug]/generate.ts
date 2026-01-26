import type { APIRoute } from 'astro';
import { getBranch, getBranchEvents, addEvent } from '../../../../lib/dal';
import { generateRecommendations } from '../../../../lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  const branch = await getBranch(slug);
  if (!branch) return new Response('Branch not found', { status: 404 });

  // Check if this is a JSON request (from client-side JS)
  const acceptHeader = request.headers.get('Accept');
  const isJsonRequest = acceptHeader?.includes('application/json');

  // Add REQUESTED event
  await addEvent(slug, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'RECOMMENDATIONS_REQUESTED',
      payload: {}
  }, 'User requested recommendations.');

  // If JSON request, return immediately and process in background
  // Note: In a true serverless environment (like Vercel/Netlify functions), 
  // background processing might be cut off when the response is sent.
  // However, for this local/Node environment or some edge runtimes, we can try to keep running.
  // A robust solution would use a queue. For this app, we'll await if it's a form post (redirect),
  // but for JSON we want to return "Processing" and let the client poll.
  
  // Since we can't easily "detach" the process in standard Astro SSR without blocking the response 
  // (unless using specific adapter features), we will actually have to AWAIT the generation here 
  // if we want to guarantee it finishes.
  // BUT, to simulate the "Async" UI experience the user wants, we can return immediately 
  // and try to let the promise resolve.
  
  const generatePromise = (async () => {
    try {
      const events = await getBranchEvents(slug);
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
    } catch (error) {
      console.error('Error generating recommendations in background:', error);
    }
  })();

  if (isJsonRequest) {
    // Return immediately for JSON requests
    // Note: If the runtime kills the process after response, this won't work.
    // In local dev (Node), this usually works.
    return new Response(JSON.stringify({ status: 'processing' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  } else {
    // For form submissions, we must await to ensure redirect happens AFTER generation
    await generatePromise;
    return redirect(`/branch/${slug}`);
  }
};
