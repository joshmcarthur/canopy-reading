import type { APIRoute } from 'astro';
import { addEvent, getBranch } from '../../../../lib/dal';
import { v4 as uuidv4 } from 'uuid';

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const { slug } = params;
  if (!slug) return new Response('Slug required', { status: 400 });

  const branch = await getBranch(slug);
  if (!branch) return new Response('Branch not found', { status: 404 });

  const formData = await request.formData();
  const content = formData.get('content')?.toString();
  const itemTitle = formData.get('itemTitle')?.toString() || undefined;

  if (!content || content.trim().length === 0) {
    return new Response('Reflection content is required', { status: 400 });
  }

  await addEvent(slug, {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    type: 'REFLECTION_ADDED',
    payload: {
      itemTitle,
      content: content.trim(),
    },
  });

  return redirect(`/branch/${slug}`);
};
