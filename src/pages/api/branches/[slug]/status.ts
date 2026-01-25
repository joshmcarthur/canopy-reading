import type { APIRoute } from 'astro';
import { addEvent } from '../../../../lib/dal';
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

  return redirect(`/branch/${slug}`);
};
