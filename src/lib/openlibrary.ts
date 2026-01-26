import type { BookMetadata } from '../domain/types';

const OPENLIBRARY_SEARCH_URL = 'https://openlibrary.org/search.json';
const OPENLIBRARY_COVERS_BASE = 'https://covers.openlibrary.org/b';

/**
 * Search for a book by ISBN (most reliable method)
 */
export async function searchBookByISBN(isbn: string): Promise<BookMetadata | null> {
  try {
    // Remove any hyphens or spaces from ISBN
    const cleanISBN = isbn.replace(/[-\s]/g, '');
    const url = `${OPENLIBRARY_SEARCH_URL}?q=isbn:${encodeURIComponent(cleanISBN)}&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`OpenLibrary API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    return extractMetadata(data.docs[0]);
  } catch (error) {
    console.error('Error searching OpenLibrary by ISBN:', error);
    return null;
  }
}

/**
 * Search for a book by title and author (fallback method)
 */
export async function searchBookByTitleAndAuthor(
  title: string,
  author: string
): Promise<BookMetadata | null> {
  try {
    const url = `${OPENLIBRARY_SEARCH_URL}?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`OpenLibrary API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (!data.docs || data.docs.length === 0) {
      return null;
    }

    return extractMetadata(data.docs[0]);
  } catch (error) {
    console.error('Error searching OpenLibrary by title/author:', error);
    return null;
  }
}

/**
 * Search for a book, prioritizing ISBN if available
 */
export async function searchBook(
  title: string,
  author: string,
  isbn?: string
): Promise<BookMetadata | null> {
  // If ISBN is provided, try that first (most reliable)
  if (isbn) {
    const result = await searchBookByISBN(isbn);
    if (result) {
      return result;
    }
    // If ISBN search fails, fall back to title+author
  }

  // Fall back to title + author search
  return searchBookByTitleAndAuthor(title, author);
}

/**
 * Extract metadata from OpenLibrary search result document
 */
function extractMetadata(doc: any): BookMetadata {
  const metadata: BookMetadata = {
    enrichedAt: new Date().toISOString(),
  };

  // Cover images
  if (doc.cover_i) {
    metadata.coverImageSmallUrl = `${OPENLIBRARY_COVERS_BASE}/id/${doc.cover_i}-S.jpg`;
    metadata.coverImageMediumUrl = `${OPENLIBRARY_COVERS_BASE}/id/${doc.cover_i}-M.jpg`;
    metadata.coverImageLargeUrl = `${OPENLIBRARY_COVERS_BASE}/id/${doc.cover_i}-L.jpg`;
    metadata.coverImageUrl = metadata.coverImageMediumUrl; // Default to medium
  } else if (doc.cover_edition_key) {
    // Fallback to edition key for cover
    const olid = doc.cover_edition_key.replace(/^\/books\//, '').replace(/^\/b\//, '');
    metadata.coverImageSmallUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-S.jpg`;
    metadata.coverImageMediumUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-M.jpg`;
    metadata.coverImageLargeUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-L.jpg`;
    metadata.coverImageUrl = metadata.coverImageMediumUrl;
  } else if (doc.edition_key && doc.edition_key.length > 0) {
    // Use first edition key
    const olid = doc.edition_key[0].replace(/^\/books\//, '').replace(/^\/b\//, '');
    metadata.coverImageSmallUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-S.jpg`;
    metadata.coverImageMediumUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-M.jpg`;
    metadata.coverImageLargeUrl = `${OPENLIBRARY_COVERS_BASE}/olid/${olid}-L.jpg`;
    metadata.coverImageUrl = metadata.coverImageMediumUrl;
  }

  // ISBNs
  if (doc.isbn && Array.isArray(doc.isbn)) {
    // Separate ISBN-10 (10 digits) and ISBN-13 (13 digits)
    const isbn10 = doc.isbn.find((isbn: string) => /^\d{10}$/.test(isbn.replace(/[-\s]/g, '')));
    const isbn13 = doc.isbn.find((isbn: string) => /^\d{13}$/.test(isbn.replace(/[-\s]/g, '')));
    
    if (isbn10) metadata.isbn10 = isbn10;
    if (isbn13) metadata.isbn13 = isbn13;
  }

  // OpenLibrary keys
  if (doc.key) {
    metadata.openLibraryWorkKey = doc.key;
  }
  if (doc.edition_key && doc.edition_key.length > 0) {
    metadata.openLibraryEditionKey = doc.edition_key[0];
  }

  // Author keys
  if (doc.author_key && Array.isArray(doc.author_key)) {
    metadata.authorKeys = doc.author_key;
  }

  // Publication info
  if (doc.first_publish_year) {
    metadata.firstPublishYear = doc.first_publish_year;
  }
  if (doc.publish_year && Array.isArray(doc.publish_year) && doc.publish_year.length > 0) {
    // Use the most recent publish year, or first if sorted
    const years = doc.publish_year.filter((y: any) => typeof y === 'number').sort((a: number, b: number) => b - a);
    if (years.length > 0) {
      metadata.publishDate = years[0].toString();
    }
  }

  // Page count
  if (doc.number_of_pages_median) {
    metadata.numberOfPages = doc.number_of_pages_median;
  } else if (doc.number_of_pages && typeof doc.number_of_pages === 'number') {
    metadata.numberOfPages = doc.number_of_pages;
  }

  // Publisher
  if (doc.publisher && Array.isArray(doc.publisher)) {
    metadata.publisher = doc.publisher;
  }

  // Language
  if (doc.language && Array.isArray(doc.language)) {
    metadata.language = doc.language;
  }

  // Description - Note: OpenLibrary search API doesn't return descriptions
  // Would need to fetch the work/edition details separately for this
  // For now, we'll leave it empty and can enhance later if needed

  return metadata;
}
