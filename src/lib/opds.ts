import type { BookItem, Branch } from '../domain/types';

/**
 * OPDS 2.0 Type Definitions
 * Based on the OPDS 2.0 specification: https://drafts.opds.io/opds-2.0.html
 */

export interface OPDSLink {
  href: string;
  type?: string;
  rel?: string;
  title?: string;
}

export interface OPDSAuthor {
  name: string;
  uri?: string;
}

export interface OPDSMetadata {
  '@type'?: string;
  title: string;
  description?: string;
  modified?: string;
  author?: OPDSAuthor[];
  language?: string[];
  identifier?: string;
  '@context'?: string;
}

export interface OPDSPublicationMetadata extends OPDSMetadata {
  '@type': 'http://schema.org/Book';
  title: string;
  author: OPDSAuthor[];
  description?: string;
  identifier?: string;
}

export interface OPDSPublication {
  metadata: OPDSPublicationMetadata;
  images?: Array<{
    href: string;
    type: string;
  }>;
  links: OPDSLink[];
}

export interface OPDSCatalog {
  metadata: OPDSMetadata;
  links: OPDSLink[];
  publications: OPDSPublication[];
}

/**
 * Construct OpenLibrary URL from metadata keys
 */
function getOpenLibraryUrl(metadata?: { openLibraryWorkKey?: string; openLibraryEditionKey?: string }): string | null {
  if (!metadata) return null;

  if (metadata.openLibraryWorkKey) {
    const key = metadata.openLibraryWorkKey.startsWith('/') 
      ? metadata.openLibraryWorkKey 
      : `/${metadata.openLibraryWorkKey}`;
    return `https://openlibrary.org${key}`;
  }

  if (metadata.openLibraryEditionKey) {
    const key = metadata.openLibraryEditionKey.startsWith('/') 
      ? metadata.openLibraryEditionKey 
      : `/${metadata.openLibraryEditionKey}`;
    return `https://openlibrary.org${key}`;
  }

  return null;
}

/**
 * Transform a BookItem to an OPDS Publication
 */
export function bookItemToOPDSPublication(
  item: BookItem,
  baseUrl: string,
  branchSlug: string
): OPDSPublication {
  const links: OPDSLink[] = [];

  // Add OpenLibrary link if available
  const openLibraryUrl = getOpenLibraryUrl(item.metadata);
  if (openLibraryUrl) {
    links.push({
      href: openLibraryUrl,
      type: 'text/html',
      rel: 'alternate',
      title: 'View on OpenLibrary',
    });
  }

  // Add link to branch page
  const branchPageUrl = `${baseUrl}/branch/${branchSlug}`;
  links.push({
    href: branchPageUrl,
    type: 'text/html',
    rel: 'alternate',
    title: 'View on Canopy',
  });

  // Build author array
  const authors: OPDSAuthor[] = item.author
    ? [{ name: item.author }]
    : [];

  // Build metadata
  const metadata: OPDSPublicationMetadata = {
    '@type': 'http://schema.org/Book',
    title: item.title,
    author: authors,
  };

  // Add description from reason if available
  if (item.reason) {
    metadata.description = item.reason;
  }

  // Add ISBN identifier if available
  if (item.metadata?.isbn13) {
    metadata.identifier = `urn:isbn:${item.metadata.isbn13}`;
  } else if (item.metadata?.isbn10) {
    metadata.identifier = `urn:isbn:${item.metadata.isbn10}`;
  }

  // Build images array from cover URLs
  const images: Array<{ href: string; type: string }> = [];
  if (item.metadata?.coverImageUrl) {
    images.push({
      href: item.metadata.coverImageUrl,
      type: 'image/jpeg',
    });
  } else if (item.metadata?.coverImageLargeUrl) {
    images.push({
      href: item.metadata.coverImageLargeUrl,
      type: 'image/jpeg',
    });
  } else if (item.metadata?.coverImageMediumUrl) {
    images.push({
      href: item.metadata.coverImageMediumUrl,
      type: 'image/jpeg',
    });
  } else if (item.metadata?.coverImageSmallUrl) {
    images.push({
      href: item.metadata.coverImageSmallUrl,
      type: 'image/jpeg',
    });
  }

  return {
    metadata,
    images: images.length > 0 ? images : undefined,
    links,
  };
}

/**
 * Transform a Branch and its publications to an OPDS Catalog
 */
export function branchToOPDSCatalog(
  branch: Branch,
  publications: OPDSPublication[],
  baseUrl: string,
  opdsFeedUrl: string
): OPDSCatalog {
  const links: OPDSLink[] = [
    {
      href: opdsFeedUrl,
      type: 'application/opds+json',
      rel: 'self',
    },
  ];

  const metadata: OPDSMetadata = {
    '@type': 'http://schema.org/DataCatalog',
    '@context': 'https://schema.org',
    title: branch.name,
    description: branch.description,
    modified: new Date().toISOString(),
  };

  return {
    metadata,
    links,
    publications,
  };
}
