import type { Params } from "astro";
import { beforeEach, describe, expect, it } from "vitest";
import { projectBranchState } from "../../../src/domain/projection";
import { getBranchEvents } from "../../../src/lib/dal";
import type {
	OPDSCatalog,
	OPDSLink,
	OPDSPublication,
} from "../../../src/lib/opds";
import {
	createMockRecommendation,
	createRecommendationsGeneratedEvent,
	createStatusChangedEvent,
	createTestBranch,
	createTestContext,
	resetStorage,
} from "../helpers";

describe("OPDS API Integration", () => {
	beforeEach(() => {
		resetStorage();
	});

	const GET = async (params: Params, request: Request) => {
		return await import("../../../src/pages/api/branches/[slug]/opds").then(
			(module) =>
				module.GET(
					createTestContext({
						params,
						request,
					}),
				),
		);
	};

	it("should return 400 if slug is missing", async () => {
		const request = new Request("http://localhost/api/branches/test/opds");

		const response = await GET({}, request);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Slug required");
	});

	it("should return 404 if branch does not exist", async () => {
		const request = new Request(
			"http://localhost/api/branches/nonexistent/opds",
		);

		const response = await GET({ slug: "nonexistent" }, request);

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("Branch not found");
	});

	it("should return OPDS catalog with correct structure", async () => {
		const recommendations = [
			createMockRecommendation(
				"Book A",
				"Author A",
				"Why you should read Book A",
				{
					coverImageUrl: "https://example.com/cover.jpg",
					isbn13: "9780123456789",
					openLibraryWorkKey: "/works/OL123W",
				},
			),
			createMockRecommendation(
				"Book B",
				"Author B",
				"Why you should read Book B",
			),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent1 = createStatusChangedEvent("Book A", "ACCEPTED");
		const acceptedEvent2 = createStatusChangedEvent("Book B", "ACCEPTED");
		const branch = await createTestBranch(
			"Test Branch OPDS",
			"A test branch for OPDS",
			[generatedEvent, acceptedEvent1, acceptedEvent2],
		);

		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/opds`,
		);

		const response = await GET({ slug: branch.slug }, request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/opds+json");
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");

		const catalog = (await response.json()) as OPDSCatalog;

		// Verify catalog structure
		expect(catalog).toHaveProperty("metadata");
		expect(catalog).toHaveProperty("links");
		expect(catalog).toHaveProperty("publications");

		// Verify metadata
		expect(catalog.metadata.title).toBe("Test Branch OPDS");
		expect(catalog.metadata.description).toBe("A test branch for OPDS");
		expect(catalog.metadata["@type"]).toBe("http://schema.org/DataCatalog");

		// Verify self link
		const selfLink = catalog.links.find(
			(link: OPDSLink) => link.rel === "self",
		);
		expect(selfLink).toBeDefined();
		expect(selfLink?.type).toBe("application/opds+json");

		// Verify publications
		expect(catalog.publications).toHaveLength(2);
	});

	it("should only include ACCEPTED and DEFERRED books in feed", async () => {
		const recommendations = [
			createMockRecommendation("Accepted Book", "Author A", "Reason"),
			createMockRecommendation("Deferred Book", "Author B", "Reason"),
			createMockRecommendation("Read Book", "Author C", "Reason"),
			createMockRecommendation("Pending Book", "Author D", "Reason"),
			createMockRecommendation("Rejected Book", "Author E", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent("Accepted Book", "ACCEPTED");
		const deferredEvent = createStatusChangedEvent("Deferred Book", "DEFERRED");
		const readEvent = createStatusChangedEvent("Read Book", "ALREADY_READ");
		const rejectedEvent = createStatusChangedEvent("Rejected Book", "REJECTED");

		const branch = await createTestBranch("Test Branch", "A test branch", [
			generatedEvent,
			acceptedEvent,
			deferredEvent,
			readEvent,
			rejectedEvent,
		]);

		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/opds`,
		);

		const response = await GET({ slug: branch.slug }, request);

		const catalog = (await response.json()) as OPDSCatalog;

		// Should only include ACCEPTED and DEFERRED
		expect(catalog.publications).toHaveLength(2);
		const titles = catalog.publications.map(
			(p: OPDSPublication) => p.metadata.title,
		);
		expect(titles).toContain("Accepted Book");
		expect(titles).toContain("Deferred Book");
		expect(titles).not.toContain("Read Book");
		expect(titles).not.toContain("Pending Book");
		expect(titles).not.toContain("Rejected Book");
	});

	it("should include book metadata in publications", async () => {
		const bookItem = createMockRecommendation(
			"Book with Metadata",
			"Author Name",
			"Why you should read Book with Metadata",
			{
				coverImageUrl: "https://example.com/cover.jpg",
				coverImageLargeUrl: "https://example.com/cover-large.jpg",
				isbn10: "0123456789",
				isbn13: "9780123456789",
				description: "Book description",
				firstPublishYear: 2020,
				openLibraryWorkKey: "/works/OL123W",
				openLibraryEditionKey: "/books/OL456B",
			},
		);

		const generatedEvent = createRecommendationsGeneratedEvent([bookItem]);
		const acceptedEvent = createStatusChangedEvent(
			"Book with Metadata",
			"ACCEPTED",
		);

		const branch = await createTestBranch(
			"Test Branch Metadata",
			"A test branch",
			[generatedEvent, acceptedEvent],
		);

		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/opds`,
		);

		const response = await GET({ slug: branch.slug }, request);

		const catalog = (await response.json()) as OPDSCatalog;
		const publication = catalog.publications[0];

		// Verify publication structure
		expect(publication.metadata["@type"]).toBe("http://schema.org/Book");
		expect(publication.metadata.title).toBe("Book with Metadata");
		expect(publication.metadata.author).toHaveLength(1);
		expect(publication.metadata.author[0].name).toBe("Author Name");
		expect(publication.metadata.description).toBe(
			"Why you should read Book with Metadata",
		);
		expect(publication.metadata.identifier).toBe("urn:isbn:9780123456789");

		// Verify images
		expect(publication.images).toBeDefined();
		expect(publication.images).toHaveLength(1);
		expect(publication.images?.[0].href).toBe("https://example.com/cover.jpg");
		expect(publication.images?.[0].type).toBe("image/jpeg");

		// Verify links
		expect(publication.links).toBeDefined();
		expect(publication.links.length).toBeGreaterThan(0);

		// Should have OpenLibrary link
		const openLibraryLink = publication.links.find((link: OPDSLink) =>
			link.href.includes("openlibrary.org"),
		);
		expect(openLibraryLink).toBeDefined();
		expect(openLibraryLink?.href).toBe("https://openlibrary.org/works/OL123W");
	});

	it("should handle books without metadata gracefully", async () => {
		const bookItem = createMockRecommendation(
			"Simple Book",
			"Author",
			"Reason",
		);
		const generatedEvent = createRecommendationsGeneratedEvent([bookItem]);
		const acceptedEvent = createStatusChangedEvent("Simple Book", "ACCEPTED");

		const branch = await createTestBranch(
			"Test Branch Simple",
			"A test branch",
			[generatedEvent, acceptedEvent],
		);

		const { GET } = await import("../../../src/pages/api/branches/[slug]/opds");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/opds`,
		);

		const response = await GET(
			createTestContext({
				params: { slug: branch.slug },
				request,
			}),
		);

		const catalog = (await response.json()) as OPDSCatalog;
		const publication = catalog.publications[0];

		expect(publication.metadata.title).toBe("Simple Book");
		expect(publication.metadata.author[0].name).toBe("Author");
		// Images should be undefined if no cover URL
		expect(publication.images).toBeUndefined();
		// Should still have branch page link
		expect(publication.links.length).toBeGreaterThan(0);
	});

	it("should return empty publications array when no to-read books", async () => {
		const recommendations = [
			createMockRecommendation("Read Book", "Author", "Reason"),
			createMockRecommendation("Pending Book", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const readEvent = createStatusChangedEvent("Read Book", "ALREADY_READ");

		const branch = await createTestBranch(
			"Test Branch Empty",
			"A test branch",
			[generatedEvent, readEvent],
		);

		const { GET } = await import("../../../src/pages/api/branches/[slug]/opds");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/opds`,
		);

		const response = await GET(
			createTestContext({
				params: { slug: branch.slug },
				request,
			}),
		);

		const catalog = (await response.json()) as OPDSCatalog;

		expect(catalog.publications).toHaveLength(0);
		expect(catalog.metadata.title).toBe("Test Branch Empty");
	});

	describe("OPDS Import API", () => {
		/**
		 * Helper function to create a valid OPDS catalog for testing
		 */
		function createOPDSCatalog(
			publications: OPDSCatalog["publications"] = [],
		): OPDSCatalog {
			return {
				metadata: {
					"@type": "http://schema.org/DataCatalog",
					title: "Test Catalog",
					description: "Test OPDS catalog",
				},
				links: [],
				publications,
			};
		}

		/**
		 * Helper function to create a FormData with OPDS file
		 */
		function createImportFormData(
			catalog: OPDSCatalog,
			status = "ALREADY_READ",
		): FormData {
			const formData = new FormData();
			const blob = new Blob([JSON.stringify(catalog)], {
				type: "application/json",
			});
			const file = new File([blob], "catalog.json", {
				type: "application/json",
			});
			formData.append("file", file);
			formData.append("status", status);
			return formData;
		}

		it("should return 400 if slug is missing", async () => {
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);
			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Test Book",
						author: [{ name: "Test Author" }],
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog);

			const request = new Request(
				"http://localhost/api/branches//import-opds",
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: {},
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe("Slug required");
		});

		it("should return 404 if branch does not exist", async () => {
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);
			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Test Book",
						author: [{ name: "Test Author" }],
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog);

			const request = new Request(
				"http://localhost/api/branches/nonexistent/import-opds",
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: "nonexistent" },
					request,
				}),
			);

			expect(response.status).toBe(404);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe("Branch not found");
		});

		it("should return 400 if file is missing", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const formData = new FormData();
			formData.append("status", "ALREADY_READ");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe("OPDS file is required");
		});

		it("should return 400 if JSON is invalid", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const formData = new FormData();
			const blob = new Blob(["invalid json {"], { type: "application/json" });
			const file = new File([blob], "catalog.json", {
				type: "application/json",
			});
			formData.append("file", file);
			formData.append("status", "ALREADY_READ");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe("Invalid JSON file");
		});

		it("should return 400 if OPDS catalog structure is invalid", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const invalidCatalog: OPDSCatalog = {
				metadata: {
					"@type": "http://schema.org/DataCatalog",
					title: "Test",
				},
				links: [],
				publications: [],
				// Missing publications array validation happens in the API
			};
			const formData = createImportFormData(invalidCatalog);

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe(
				"Invalid OPDS catalog structure. Missing publications array.",
			);
		});

		it("should return 400 if publications array is empty", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([]);
			const formData = createImportFormData(catalog);

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toBe(
				"Invalid OPDS catalog structure. Missing publications array.",
			);
		});

		it("should return 400 if status is invalid", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Test Book",
						author: [{ name: "Test Author" }],
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog, "INVALID_STATUS");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(400);
			const data = (await response.json()) as { error: string };
			expect(data.error).toContain("Invalid status");
		});

		it("should successfully import books with PENDING status", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Imported Book 1",
						author: [{ name: "Author One" }],
						description: "First imported book",
						identifier: "urn:isbn:9780123456789",
					},
					images: [
						{ href: "https://example.com/cover1.jpg", type: "image/jpeg" },
					],
					links: [
						{
							href: "https://openlibrary.org/works/OL123W",
							type: "text/html",
							rel: "alternate",
						},
					],
				},
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Imported Book 2",
						author: [{ name: "Author Two" }],
						description: "Second imported book",
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog, "PENDING");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				success: boolean;
				imported: number;
				status: string;
			};
			expect(data.success).toBe(true);
			expect(data.imported).toBe(2);
			expect(data.status).toBe("PENDING");

			// Verify events were created
			const events = await getBranchEvents(branch.slug);
			const generatedEvents = events.filter(
				(e) => e.type === "RECOMMENDATIONS_GENERATED",
			);
			expect(generatedEvents).toHaveLength(1);
			expect(generatedEvents[0].payload.items).toHaveLength(2);
			expect(generatedEvents[0].payload.model).toBe("opds-import");

			// Verify no status change events were created for PENDING
			const statusChangeEvents = events.filter(
				(e) => e.type === "ITEM_STATUS_CHANGED",
			);
			expect(statusChangeEvents).toHaveLength(0);

			// Verify books appear in branch state with PENDING status
			const state = projectBranchState(events);
			expect(state.inbox).toHaveLength(2);
			expect(state.inbox[0].title).toBe("Imported Book 1");
			expect(state.inbox[0].status).toBe("PENDING");
			expect(state.inbox[0].author).toBe("Author One");
			expect(state.inbox[0].metadata?.isbn13).toBe("9780123456789");
			expect(state.inbox[0].metadata?.coverImageUrl).toBe(
				"https://example.com/cover1.jpg",
			);
			expect(state.inbox[0].metadata?.openLibraryWorkKey).toBe("/works/OL123W");
		});

		it("should successfully import books with ACCEPTED status", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Accepted Book",
						author: [{ name: "Author Name" }],
						description: "A book to accept",
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog, "ACCEPTED");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				success: boolean;
				imported: number;
				status: string;
			};
			expect(data.success).toBe(true);
			expect(data.imported).toBe(1);
			expect(data.status).toBe("ACCEPTED");

			// Verify events were created
			const events = await getBranchEvents(branch.slug);
			const generatedEvents = events.filter(
				(e) => e.type === "RECOMMENDATIONS_GENERATED",
			);
			expect(generatedEvents).toHaveLength(1);

			// Verify status change events were created
			const statusChangeEvents = events.filter(
				(e) => e.type === "ITEM_STATUS_CHANGED",
			);
			expect(statusChangeEvents).toHaveLength(1);
			expect(statusChangeEvents[0].payload.itemTitle).toBe("Accepted Book");
			expect(statusChangeEvents[0].payload.status).toBe("ACCEPTED");

			// Verify books appear in library with ACCEPTED status
			const state = projectBranchState(events);
			expect(state.inbox).toHaveLength(0);
			expect(state.library).toHaveLength(1);
			expect(state.library[0].title).toBe("Accepted Book");
			expect(state.library[0].status).toBe("ACCEPTED");
		});

		it("should successfully import books with ALREADY_READ status", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Read Book",
						author: [{ name: "Author Name" }],
					},
					links: [],
				},
			]);
			const formData = createImportFormData(catalog, "ALREADY_READ");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as {
				success: boolean;
				imported: number;
			};
			expect(data.success).toBe(true);
			expect(data.imported).toBe(1);

			// Verify status change events were created
			const events = await getBranchEvents(branch.slug);
			const statusChangeEvents = events.filter(
				(e) => e.type === "ITEM_STATUS_CHANGED",
			);
			expect(statusChangeEvents).toHaveLength(1);
			expect(statusChangeEvents[0].payload.status).toBe("ALREADY_READ");

			// Verify books appear in library
			const state = projectBranchState(events);
			expect(state.library).toHaveLength(1);
			expect(state.library[0].status).toBe("ALREADY_READ");
		});

		it("should successfully import multiple books with different statuses", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			// Import with ACCEPTED status
			const catalog1 = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Accepted Book",
						author: [{ name: "Author A" }],
					},
					links: [],
				},
			]);
			const formData1 = createImportFormData(catalog1, "ACCEPTED");

			const request1 = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData1,
				},
			);

			await POST(
				createTestContext({
					params: { slug: branch.slug },
					request: request1,
				}),
			);

			// Import with DEFERRED status
			const catalog2 = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Deferred Book",
						author: [{ name: "Author B" }],
					},
					links: [],
				},
			]);
			const formData2 = createImportFormData(catalog2, "DEFERRED");

			const request2 = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData2,
				},
			);

			await POST(
				createTestContext({
					params: { slug: branch.slug },
					request: request2,
				}),
			);

			// Verify both imports worked
			const events = await getBranchEvents(branch.slug);
			const generatedEvents = events.filter(
				(e) => e.type === "RECOMMENDATIONS_GENERATED",
			);
			expect(generatedEvents).toHaveLength(2);

			const statusChangeEvents = events.filter(
				(e) => e.type === "ITEM_STATUS_CHANGED",
			);
			expect(statusChangeEvents).toHaveLength(2);

			const state = projectBranchState(events);
			expect(state.library).toHaveLength(2);
			expect(
				state.library.find((b) => b.title === "Accepted Book")?.status,
			).toBe("ACCEPTED");
			expect(
				state.library.find((b) => b.title === "Deferred Book")?.status,
			).toBe("DEFERRED");
		});

		it("should handle books without titles gracefully", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Valid Book",
						author: [{ name: "Author" }],
					},
					links: [],
				},
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "", // Empty title - should be skipped
						author: [{ name: "Author" }],
					},
					links: [],
				} as OPDSPublication, // Type assertion to allow testing invalid data (empty title)
			]);
			const formData = createImportFormData(catalog, "ACCEPTED");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			const response = await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			expect(response.status).toBe(200);
			const data = (await response.json()) as { imported: number };
			// Should only import the book with a title
			expect(data.imported).toBe(1);

			const events = await getBranchEvents(branch.slug);
			const generatedEvents = events.filter(
				(e) => e.type === "RECOMMENDATIONS_GENERATED",
			);
			expect(generatedEvents[0].payload.items).toHaveLength(1);
			expect(generatedEvents[0].payload.items[0].title).toBe("Valid Book");
		});

		it("should extract metadata correctly from OPDS publications", async () => {
			const branch = await createTestBranch("Test Branch", "A test branch");
			const { POST } = await import(
				"../../../src/pages/api/branches/[slug]/import-opds"
			);

			const catalog = createOPDSCatalog([
				{
					metadata: {
						"@type": "http://schema.org/Book",
						title: "Book with Full Metadata",
						author: [{ name: "Author One" }, { name: "Author Two" }],
						description: "A comprehensive book description",
						identifier: "urn:isbn:9780123456789",
					},
					images: [
						{ href: "https://example.com/cover.jpg", type: "image/jpeg" },
					],
					links: [
						{
							href: "https://openlibrary.org/works/OL123W",
							type: "text/html",
							rel: "alternate",
						},
					],
				},
			]);
			const formData = createImportFormData(catalog, "ACCEPTED");

			const request = new Request(
				`http://localhost/api/branches/${branch.slug}/import-opds`,
				{
					method: "POST",
					body: formData,
				},
			);

			await POST(
				createTestContext({
					params: { slug: branch.slug },
					request,
				}),
			);

			const events = await getBranchEvents(branch.slug);
			const generatedEvents = events.filter(
				(e) => e.type === "RECOMMENDATIONS_GENERATED",
			);
			const item = generatedEvents[0].payload.items[0];

			// Verify metadata extraction
			expect(item.title).toBe("Book with Full Metadata");
			expect(item.author).toBe("Author One, Author Two"); // Multiple authors joined
			expect(item.reason).toBe("A comprehensive book description");
			expect(item.metadata?.isbn13).toBe("9780123456789");
			expect(item.metadata?.coverImageUrl).toBe(
				"https://example.com/cover.jpg",
			);
			expect(item.metadata?.openLibraryWorkKey).toBe("/works/OL123W");
			expect(item.metadata?.description).toBe(
				"A comprehensive book description",
			);
		});
	});
});
