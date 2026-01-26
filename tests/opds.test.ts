import { describe, it, expect, beforeAll, vi } from 'vitest';
import { resetAdapter } from '../src/lib/dal/factory';
import type { Branch, BookItem, AppEvent } from '../src/domain/types';

// Mock the DAL module
vi.mock('../src/lib/dal/index', () => ({
  getBranch: vi.fn(),
  getBranchEvents: vi.fn(),
}));

describe('OPDS API Endpoint', () => {
  beforeAll(() => {
    process.env.CANOPY_STORAGE_ADAPTER = 'memory';
    resetAdapter();
  });

  const createMockBranch = (): Branch => ({
    id: 'test-branch-id',
    slug: 'test-branch',
    name: 'Test Branch',
    description: 'A test branch for OPDS',
    createdAt: '2023-01-01T00:00:00Z',
  });

  const createMockBookItem = (
    title: string,
    author: string,
    status: 'ACCEPTED' | 'DEFERRED' | 'ALREADY_READ' | 'PENDING' | 'REJECTED',
    metadata?: BookItem['metadata']
  ): BookItem => ({
    title,
    author,
    reason: `Why you should read ${title}`,
    status,
    addedAt: '2023-01-01T00:00:00Z',
    metadata,
  });

  const createMockEvents = (items: BookItem[]): AppEvent[] => {
    const events: AppEvent[] = [
      {
        id: '1',
        timestamp: '2023-01-01T00:00:00Z',
        type: 'BRANCH_CREATED',
        payload: {
          name: 'Test Branch',
          description: 'A test branch',
        },
      },
      {
        id: '2',
        timestamp: '2023-01-02T00:00:00Z',
        type: 'RECOMMENDATIONS_GENERATED',
        payload: {
          items: items.map((item) => ({
            title: item.title,
            author: item.author,
            reason: item.reason,
            metadata: item.metadata,
          })),
          model: 'gpt-4',
        },
      },
    ];

    // Add status change events for items that are not PENDING
    items.forEach((item, index) => {
      if (item.status !== 'PENDING') {
        events.push({
          id: `status-${index}`,
          timestamp: `2023-01-0${3 + index}T00:00:00Z`,
          type: 'ITEM_STATUS_CHANGED',
          payload: {
            itemTitle: item.title,
            status: item.status,
          },
        });
      }
    });

    return events;
  };

  it('should return 400 if slug is missing', async () => {
    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test/opds');

    const response = await GET({
      params: {},
      request,
    } as any);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Slug required');
  });

  it('should return 404 if branch does not exist', async () => {
    const { getBranch } = await import('../src/lib/dal/index');
    vi.mocked(getBranch).mockResolvedValue(null);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/nonexistent/opds');

    const response = await GET({
      params: { slug: 'nonexistent' },
      request,
    } as any);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Branch not found');
  });

  it('should return OPDS catalog with correct structure', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItems = [
      createMockBookItem('Book A', 'Author A', 'ACCEPTED', {
        coverImageUrl: 'https://example.com/cover.jpg',
        isbn13: '9780123456789',
        openLibraryWorkKey: '/works/OL123W',
      }),
      createMockBookItem('Book B', 'Author B', 'DEFERRED'),
    ];
    const events = createMockEvents(bookItems);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/opds+json');
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600');

    const catalog = await response.json();

    // Verify catalog structure
    expect(catalog).toHaveProperty('metadata');
    expect(catalog).toHaveProperty('links');
    expect(catalog).toHaveProperty('publications');

    // Verify metadata
    expect(catalog.metadata.title).toBe('Test Branch');
    expect(catalog.metadata.description).toBe('A test branch for OPDS');
    expect(catalog.metadata['@type']).toBe('http://schema.org/DataCatalog');

    // Verify self link
    const selfLink = catalog.links.find((link: any) => link.rel === 'self');
    expect(selfLink).toBeDefined();
    expect(selfLink.href).toBe('http://localhost/api/branches/test-branch/opds');
    expect(selfLink.type).toBe('application/opds+json');

    // Verify publications
    expect(catalog.publications).toHaveLength(2);
  });

  it('should only include ACCEPTED and DEFERRED books in feed', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItems = [
      createMockBookItem('Accepted Book', 'Author A', 'ACCEPTED'),
      createMockBookItem('Deferred Book', 'Author B', 'DEFERRED'),
      createMockBookItem('Read Book', 'Author C', 'ALREADY_READ'),
      createMockBookItem('Pending Book', 'Author D', 'PENDING'),
      createMockBookItem('Rejected Book', 'Author E', 'REJECTED'),
    ];
    const events = createMockEvents(bookItems);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();

    // Should only include ACCEPTED and DEFERRED
    expect(catalog.publications).toHaveLength(2);
    const titles = catalog.publications.map((p: any) => p.metadata.title);
    expect(titles).toContain('Accepted Book');
    expect(titles).toContain('Deferred Book');
    expect(titles).not.toContain('Read Book');
    expect(titles).not.toContain('Pending Book');
    expect(titles).not.toContain('Rejected Book');
  });

  it('should include book metadata in publications', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItem = createMockBookItem(
      'Book with Metadata',
      'Author Name',
      'ACCEPTED',
      {
        coverImageUrl: 'https://example.com/cover.jpg',
        coverImageLargeUrl: 'https://example.com/cover-large.jpg',
        isbn10: '0123456789',
        isbn13: '9780123456789',
        description: 'Book description',
        firstPublishYear: 2020,
        openLibraryWorkKey: '/works/OL123W',
        openLibraryEditionKey: '/books/OL456B',
      }
    );
    const events = createMockEvents([bookItem]);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();
    const publication = catalog.publications[0];

    // Verify publication structure
    expect(publication.metadata['@type']).toBe('http://schema.org/Book');
    expect(publication.metadata.title).toBe('Book with Metadata');
    expect(publication.metadata.author).toHaveLength(1);
    expect(publication.metadata.author[0].name).toBe('Author Name');
    expect(publication.metadata.description).toBe('Why you should read Book with Metadata');
    expect(publication.metadata.identifier).toBe('urn:isbn:9780123456789');

    // Verify images
    expect(publication.images).toBeDefined();
    expect(publication.images).toHaveLength(1);
    expect(publication.images[0].href).toBe('https://example.com/cover.jpg');
    expect(publication.images[0].type).toBe('image/jpeg');

    // Verify links
    expect(publication.links).toBeDefined();
    expect(publication.links.length).toBeGreaterThan(0);

    // Should have OpenLibrary link
    const openLibraryLink = publication.links.find(
      (link: any) => link.href.includes('openlibrary.org')
    );
    expect(openLibraryLink).toBeDefined();
    expect(openLibraryLink.href).toBe('https://openlibrary.org/works/OL123W');

    // Should have branch page link
    const branchLink = publication.links.find(
      (link: any) => link.href.includes('/branch/test-branch')
    );
    expect(branchLink).toBeDefined();
    expect(branchLink.href).toBe('http://localhost/branch/test-branch');
  });

  it('should handle books without metadata gracefully', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItem = createMockBookItem('Simple Book', 'Author', 'ACCEPTED');
    const events = createMockEvents([bookItem]);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();
    const publication = catalog.publications[0];

    expect(publication.metadata.title).toBe('Simple Book');
    expect(publication.metadata.author[0].name).toBe('Author');
    // Images should be undefined if no cover URL
    expect(publication.images).toBeUndefined();
    // Should still have branch page link
    expect(publication.links.length).toBeGreaterThan(0);
  });

  it('should return empty publications array when no to-read books', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItems = [
      createMockBookItem('Read Book', 'Author', 'ALREADY_READ'),
      createMockBookItem('Pending Book', 'Author', 'PENDING'),
    ];
    const events = createMockEvents(bookItems);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();

    expect(catalog.publications).toHaveLength(0);
    expect(catalog.metadata.title).toBe('Test Branch');
  });

  it('should handle errors gracefully', async () => {
    const { getBranch } = await import('../src/lib/dal/index');
    vi.mocked(getBranch).mockRejectedValue(new Error('Database error'));

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    expect(response.status).toBe(500);
    const error = await response.json();
    expect(error.error).toBe('Failed to generate OPDS feed');
  });

  it('should use fallback cover images when primary is not available', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItem = createMockBookItem(
      'Book with Fallback Cover',
      'Author',
      'ACCEPTED',
      {
        // No coverImageUrl, but has fallback sizes
        coverImageLargeUrl: 'https://example.com/large.jpg',
        coverImageMediumUrl: 'https://example.com/medium.jpg',
        coverImageSmallUrl: 'https://example.com/small.jpg',
      }
    );
    const events = createMockEvents([bookItem]);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();
    const publication = catalog.publications[0];

    // Should use largeUrl as fallback
    expect(publication.images).toBeDefined();
    expect(publication.images[0].href).toBe('https://example.com/large.jpg');
  });

  it('should prefer openLibraryWorkKey over openLibraryEditionKey', async () => {
    const { getBranch, getBranchEvents } = await import('../src/lib/dal/index');
    const branch = createMockBranch();
    const bookItem = createMockBookItem('Book', 'Author', 'ACCEPTED', {
      openLibraryWorkKey: '/works/OL123W',
      openLibraryEditionKey: '/books/OL456B',
    });
    const events = createMockEvents([bookItem]);

    vi.mocked(getBranch).mockResolvedValue(branch);
    vi.mocked(getBranchEvents).mockResolvedValue(events);

    const { GET } = await import('../src/pages/api/branches/[slug]/opds');
    const request = new Request('http://localhost/api/branches/test-branch/opds');

    const response = await GET({
      params: { slug: 'test-branch' },
      request,
    } as any);

    const catalog = await response.json();
    const publication = catalog.publications[0];

    const openLibraryLink = publication.links.find(
      (link: any) => link.href.includes('openlibrary.org')
    );
    expect(openLibraryLink.href).toBe('https://openlibrary.org/works/OL123W');
  });
});
