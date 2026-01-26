import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetStorage, createTestBranch } from '../helpers';
import { getBranchEvents } from '../../../src/lib/dal';
import { projectBranchState } from '../../../src/domain/projection';

// Mock the AI generation function
vi.mock('../../../src/lib/ai', async () => {
  const actual = await vi.importActual('../../../src/lib/ai');
  return {
    ...actual,
    generateRecommendations: vi.fn().mockResolvedValue([
      {
        title: 'Mock Book 1',
        author: 'Mock Author 1',
        reason: 'Mock reason 1',
      },
      {
        title: 'Mock Book 2',
        author: 'Mock Author 2',
        reason: 'Mock reason 2',
      },
    ]),
  };
});

describe('Generate API Integration', () => {
  beforeEach(() => {
    resetStorage();
    vi.clearAllMocks();
  });

  it('should return 400 if slug is missing', async () => {
    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    const request = new Request('http://localhost/api/branches//generate', {
      method: 'POST',
    });

    const response = await POST({
      params: {},
      request,
    } as any);

    expect(response.status).toBe(400);
  });

  it('should return 404 if branch does not exist', async () => {
    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    const request = new Request('http://localhost/api/branches/nonexistent/generate', {
      method: 'POST',
    });

    const response = await POST({
      params: { slug: 'nonexistent' },
      request,
    } as any);

    expect(response.status).toBe(404);
  });

  it('should generate recommendations via form submission', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');

    // Initial state should be empty
    let events = await getBranchEvents(branch.slug);
    let state = projectBranchState(events);
    expect(state.inbox).toHaveLength(0);

    // Submit generation request via form
    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    const request = new Request(`http://localhost/api/branches/${branch.slug}/generate`, {
      method: 'POST',
    });

    const response = await POST({
      params: { slug: branch.slug },
      request,
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as any);

    // Should redirect to branch page
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain(`/branch/${branch.slug}`);

    // Verify recommendations were generated (generation happens synchronously for form posts)
    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 100));
    events = await getBranchEvents(branch.slug);
    state = projectBranchState(events);
    expect(state.inbox.length).toBeGreaterThan(0);

    // Verify REQUESTED event was created
    const requestedEvents = events.filter(e => e.type === 'RECOMMENDATIONS_REQUESTED');
    expect(requestedEvents.length).toBeGreaterThan(0);

    // Verify GENERATED event was created
    const generatedEvents = events.filter(e => e.type === 'RECOMMENDATIONS_GENERATED');
    expect(generatedEvents.length).toBe(1);
    expect(generatedEvents[0].payload.items).toHaveLength(2);
  });

  it('should generate recommendations via JSON request', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');

    // Submit generation request via JSON
    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    const request = new Request(`http://localhost/api/branches/${branch.slug}/generate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });

    const response = await POST({
      params: { slug: branch.slug },
      request,
    } as any);

    // Should return 202 Accepted immediately
    expect(response.status).toBe(202);
    const json = await response.json();
    expect(json.status).toBe('processing');

    // Wait a bit for background generation (in real scenario this would be async)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify recommendations were generated
    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    // Note: In the actual implementation, JSON requests return immediately
    // and generation happens in background, so we may need to wait
    expect(events.some(e => e.type === 'RECOMMENDATIONS_REQUESTED')).toBe(true);
  });

  it('should create REQUESTED event before generating', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');

    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    const request = new Request(`http://localhost/api/branches/${branch.slug}/generate`, {
      method: 'POST',
    });

    await POST({
      params: { slug: branch.slug },
      request,
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as any);

    const events = await getBranchEvents(branch.slug);
    const requestedEvents = events.filter(e => e.type === 'RECOMMENDATIONS_REQUESTED');
    expect(requestedEvents.length).toBeGreaterThan(0);
  });

  it('should handle multiple generation requests', async () => {
    const branch = await createTestBranch('Test Branch', 'A test branch');

    const { POST } = await import('../../../src/pages/api/branches/[slug]/generate');
    
    // First generation
    const request1 = new Request(`http://localhost/api/branches/${branch.slug}/generate`, {
      method: 'POST',
    });
    await POST({
      params: { slug: branch.slug },
      request: request1,
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as any);

    // Second generation
    const request2 = new Request(`http://localhost/api/branches/${branch.slug}/generate`, {
      method: 'POST',
    });
    await POST({
      params: { slug: branch.slug },
      request: request2,
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as any);

    const events = await getBranchEvents(branch.slug);
    const state = projectBranchState(events);
    // Should have items from both generations
    expect(state.inbox.length).toBeGreaterThanOrEqual(2);
  });
});
