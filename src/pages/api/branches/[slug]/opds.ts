import type { APIRoute } from 'astro';
import { getBranch, getBranchEvents } from '../../../../lib/dal';
import { projectBranchState } from '../../../../domain/projection';
import {
  bookItemToOPDSPublication,
  branchToOPDSCatalog,
} from '../../../../lib/opds';

export const GET: APIRoute = async ({ params, request }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  try {
    // Fetch branch metadata
    const branch = await getBranch(slug);
    if (!branch) {
      return new Response('Branch not found', { status: 404 });
    }

    // Fetch events and project to state
    const events = await getBranchEvents(slug);
    const state = projectBranchState(events);

    // Filter library items to only include ACCEPTED and DEFERRED (to-read books)
    const toReadBooks = state.library.filter(
      (item) => item.status === 'ACCEPTED' || item.status === 'DEFERRED'
    );

    // Construct base URL from request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const opdsFeedUrl = `${baseUrl}/api/branches/${slug}/opds`;

    // Transform each book item to OPDS publication
    const publications = toReadBooks.map((item) =>
      bookItemToOPDSPublication(item, baseUrl, slug)
    );

    // Create OPDS catalog
    const catalog = branchToOPDSCatalog(branch, publications, baseUrl, opdsFeedUrl);

    return new Response(JSON.stringify(catalog, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/opds+json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating OPDS feed:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate OPDS feed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
