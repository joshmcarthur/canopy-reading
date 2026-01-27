import type {
	BookItem,
	BookMetadata,
	Branch,
	RecommendationItem,
} from "../domain/types";

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
	"@type"?: string;
	title: string;
	description?: string;
	modified?: string;
	author?: OPDSAuthor[];
	language?: string[];
	identifier?: string;
	"@context"?: string;
}

export interface OPDSPublicationMetadata extends OPDSMetadata {
	"@type": "http://schema.org/Book";
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
function getOpenLibraryUrl(metadata?: {
	openLibraryWorkKey?: string;
	openLibraryEditionKey?: string;
}): string | null {
	if (!metadata) return null;

	if (metadata.openLibraryWorkKey) {
		const key = metadata.openLibraryWorkKey.startsWith("/")
			? metadata.openLibraryWorkKey
			: `/${metadata.openLibraryWorkKey}`;
		return `https://openlibrary.org${key}`;
	}

	if (metadata.openLibraryEditionKey) {
		const key = metadata.openLibraryEditionKey.startsWith("/")
			? metadata.openLibraryEditionKey
			: `/${metadata.openLibraryEditionKey}`;
		return `https://openlibrary.org${key}`;
	}

	return null;
}

/**
 * Extract ISBN from OPDS identifier (e.g., "urn:isbn:9780123456789")
 */
function extractISBN(identifier?: string): {
	isbn10?: string;
	isbn13?: string;
} {
	if (!identifier) return {};

	const match = identifier.match(/^urn:isbn:(.+)$/i);
	if (!match) return {};

	const isbn = match[1].replace(/-/g, "");
	if (isbn.length === 13) {
		return { isbn13: isbn };
	}
	if (isbn.length === 10) {
		return { isbn10: isbn };
	}

	return {};
}

/**
 * Extract OpenLibrary keys from OPDS links
 */
function extractOpenLibraryKeys(links: OPDSLink[]): {
	openLibraryWorkKey?: string;
	openLibraryEditionKey?: string;
} {
	const openLibraryLink = links.find(
		(link) =>
			link.rel === "alternate" && link.href?.includes("openlibrary.org"),
	);

	if (!openLibraryLink?.href) return {};

	const url = new URL(openLibraryLink.href);
	const path = url.pathname;

	if (path.startsWith("/works/")) {
		return { openLibraryWorkKey: path };
	}
	if (path.startsWith("/books/")) {
		return { openLibraryEditionKey: path };
	}

	return {};
}

/**
 * Extract cover image URL from OPDS images array
 */
function extractCoverImage(
	images?: Array<{ href: string; type: string }>,
): string | undefined {
	if (!images || images.length === 0) return undefined;
	return images[0].href;
}

/**
 * Transform an OPDS Catalog to RecommendationItem[]
 */
export function opdsCatalogToRecommendationItems(
	catalog: OPDSCatalog,
): RecommendationItem[] {
	if (!catalog.publications || !Array.isArray(catalog.publications)) {
		return [];
	}

	const items: RecommendationItem[] = [];

	for (const publication of catalog.publications) {
		// Skip publications without titles
		if (!publication.metadata?.title) {
			continue;
		}

		const title = publication.metadata.title;

		// Extract author(s) - join multiple authors with ", " or use first author
		let author = "Unknown Author";
		if (publication.metadata.author && publication.metadata.author.length > 0) {
			author = publication.metadata.author.map((a) => a.name).join(", ");
		}

		// Extract description/reason - use description if available, otherwise generate default
		const reason =
			publication.metadata.description || "Imported from OPDS catalog";

		// Extract ISBN from identifier
		const isbnData = extractISBN(publication.metadata.identifier);

		// Extract cover image
		const coverImageUrl = extractCoverImage(publication.images);

		// Extract OpenLibrary keys from links
		const openLibraryKeys = extractOpenLibraryKeys(publication.links || []);

		// Build BookMetadata object
		const metadata: BookMetadata = {
			...(coverImageUrl && { coverImageUrl }),
			...isbnData,
			...(publication.metadata.description && {
				description: publication.metadata.description,
			}),
			...openLibraryKeys,
		};

		items.push({
			title,
			author,
			reason,
			...(isbnData.isbn13 && { isbn: isbnData.isbn13 }),
			metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
		});
	}

	return items;
}

/**
 * Transform a BookItem to an OPDS Publication
 */
export function bookItemToOPDSPublication(
	item: BookItem,
	baseUrl: string,
	branchSlug: string,
): OPDSPublication {
	const links: OPDSLink[] = [];

	// Add OpenLibrary link if available
	const openLibraryUrl = getOpenLibraryUrl(item.metadata);
	if (openLibraryUrl) {
		links.push({
			href: openLibraryUrl,
			type: "text/html",
			rel: "alternate",
			title: "View on OpenLibrary",
		});
	}

	// Add link to branch page
	const branchPageUrl = `${baseUrl}/branch/${branchSlug}`;
	links.push({
		href: branchPageUrl,
		type: "text/html",
		rel: "alternate",
		title: "View on Canopy",
	});

	// Build author array
	const authors: OPDSAuthor[] = item.author ? [{ name: item.author }] : [];

	// Build metadata
	const metadata: OPDSPublicationMetadata = {
		"@type": "http://schema.org/Book",
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
			type: "image/jpeg",
		});
	} else if (item.metadata?.coverImageLargeUrl) {
		images.push({
			href: item.metadata.coverImageLargeUrl,
			type: "image/jpeg",
		});
	} else if (item.metadata?.coverImageMediumUrl) {
		images.push({
			href: item.metadata.coverImageMediumUrl,
			type: "image/jpeg",
		});
	} else if (item.metadata?.coverImageSmallUrl) {
		images.push({
			href: item.metadata.coverImageSmallUrl,
			type: "image/jpeg",
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
	_baseUrl: string,
	opdsFeedUrl: string,
): OPDSCatalog {
	const links: OPDSLink[] = [
		{
			href: opdsFeedUrl,
			type: "application/opds+json",
			rel: "self",
		},
	];

	const metadata: OPDSMetadata = {
		"@type": "http://schema.org/DataCatalog",
		"@context": "https://schema.org",
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
