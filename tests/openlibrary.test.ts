import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	searchBook,
	searchBookByISBN,
	searchBookByTitleAndAuthor,
} from "../src/lib/openlibrary";

describe("OpenLibrary Integration", () => {
	beforeEach(() => {
		// Clear all mocks before each test
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("searchBookByISBN", () => {
		it("should successfully find a book by ISBN", async () => {
			const mockResponse = {
				docs: [
					{
						cover_i: 1234567,
						isbn: ["9780123456789", "0123456789"],
						title: "Test Book",
						author_name: ["Test Author"],
						first_publish_year: 2020,
						key: "/works/OL123456W",
						edition_key: ["/books/OL789M"],
						author_key: ["OL456A"],
						number_of_pages_median: 300,
						publisher: ["Test Publisher"],
						language: ["eng"],
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("978-0-12-345678-9");

			expect(result).not.toBeNull();
			expect(result?.isbn10).toBe("0123456789");
			expect(result?.isbn13).toBe("9780123456789");
			expect(result?.coverImageUrl).toContain("1234567-M.jpg");
			expect(result?.openLibraryWorkKey).toBe("/works/OL123456W");
			expect(result?.firstPublishYear).toBe(2020);
			expect(result?.numberOfPages).toBe(300);
			expect(result?.publisher).toEqual(["Test Publisher"]);
			expect(result?.language).toEqual(["eng"]);
			expect(result?.enrichedAt).toBeDefined();
		});

		it("should clean ISBN by removing hyphens and spaces", async () => {
			const mockResponse = {
				docs: [
					{
						cover_i: 1234567,
						isbn: ["9780123456789"],
						title: "Test Book",
						author_name: ["Test Author"],
						key: "/works/OL123456W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			await searchBookByISBN("978-0-12-345678-9");

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("isbn:9780123456789"),
			);
		});

		it("should return null when no results found", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ docs: [] }),
			} as Response);

			const result = await searchBookByISBN("9999999999999");
			expect(result).toBeNull();
		});

		it("should return null on API error", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
			} as Response);

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const result = await searchBookByISBN("1234567890");

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should return null on network error", async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const result = await searchBookByISBN("1234567890");

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should handle cover images using edition_key fallback", async () => {
			const mockResponse = {
				docs: [
					{
						cover_edition_key: "/books/OL789M",
						title: "Test Book",
						author_name: ["Test Author"],
						key: "/works/OL123456W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("1234567890");

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("olid/OL789M-M.jpg");
		});

		it("should handle cover images using edition_key array", async () => {
			const mockResponse = {
				docs: [
					{
						edition_key: ["/books/OL789M"],
						title: "Test Book",
						author_name: ["Test Author"],
						key: "/works/OL123456W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("1234567890");

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("olid/OL789M-M.jpg");
		});
	});

	describe("searchBookByTitleAndAuthor", () => {
		it("should successfully find a book by title and author", async () => {
			const mockResponse = {
				docs: [
					{
						cover_i: 7654321,
						isbn: ["9780987654321"],
						title: "Another Book",
						author_name: ["Another Author"],
						first_publish_year: 2019,
						key: "/works/OL654321W",
						number_of_pages: 250,
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByTitleAndAuthor(
				"Another Book",
				"Another Author",
			);

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("7654321-M.jpg");
			expect(result?.firstPublishYear).toBe(2019);
			expect(result?.numberOfPages).toBe(250);
		});

		it("should URL encode title and author", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ docs: [] }),
			} as Response);

			await searchBookByTitleAndAuthor("Book & Title", "Author/Name");

			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("title=Book%20%26%20Title"),
			);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("author=Author%2FName"),
			);
		});

		it("should return null when no results found", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ docs: [] }),
			} as Response);

			const result = await searchBookByTitleAndAuthor(
				"Nonexistent Book",
				"Unknown Author",
			);
			expect(result).toBeNull();
		});

		it("should return null on API error", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
			} as Response);

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const result = await searchBookByTitleAndAuthor("Test", "Author");

			expect(result).toBeNull();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should handle publish_year array", async () => {
			const mockResponse = {
				docs: [
					{
						title: "Test Book",
						author_name: ["Test Author"],
						publish_year: [2015, 2020, 2018],
						key: "/works/OL123W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByTitleAndAuthor(
				"Test Book",
				"Test Author",
			);

			expect(result).not.toBeNull();
			expect(result?.publishDate).toBe("2020"); // Should use most recent year
		});
	});

	describe("searchBook", () => {
		it("should prioritize ISBN search when ISBN is provided", async () => {
			const isbnMockResponse = {
				docs: [
					{
						cover_i: 1111111,
						isbn: ["9781111111111"],
						title: "ISBN Book",
						author_name: ["ISBN Author"],
						key: "/works/OL111W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => isbnMockResponse,
			} as Response);

			const result = await searchBook(
				"Some Title",
				"Some Author",
				"9781111111111",
			);

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("1111111-M.jpg");
			// Should call fetch twice: once for ISBN search, once for work description
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("isbn:9781111111111"),
			);
		});

		it("should fall back to title+author when ISBN search fails", async () => {
			const titleAuthorMockResponse = {
				docs: [
					{
						cover_i: 2222222,
						title: "Title Author Book",
						author_name: ["Title Author"],
						key: "/works/OL222W",
					},
				],
			};

			// First call (ISBN) returns no results, second call (title+author) succeeds
			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({ docs: [] }),
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => titleAuthorMockResponse,
				} as Response);

			const result = await searchBook(
				"Title Author Book",
				"Title Author",
				"9999999999999",
			);

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("2222222-M.jpg");
			// Should call fetch 3 times: ISBN search, title+author search, work description
			expect(global.fetch).toHaveBeenCalledTimes(3);
		});

		it("should use title+author when ISBN is not provided", async () => {
			const mockResponse = {
				docs: [
					{
						cover_i: 3333333,
						title: "No ISBN Book",
						author_name: ["No ISBN Author"],
						key: "/works/OL333W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBook("No ISBN Book", "No ISBN Author");

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toContain("3333333-M.jpg");
			// Should call fetch twice: once for title+author search, once for work description
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(global.fetch).toHaveBeenCalledWith(
				expect.stringContaining("title=No%20ISBN%20Book"),
			);
		});

		it("should return null when both searches fail", async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => ({ docs: [] }),
			} as Response);

			const result = await searchBook("Nonexistent", "Author", "9999999999999");

			expect(result).toBeNull();
			expect(global.fetch).toHaveBeenCalledTimes(2);
		});
	});

	describe("metadata extraction edge cases", () => {
		it("should handle books without cover images", async () => {
			const mockResponse = {
				docs: [
					{
						title: "No Cover Book",
						author_name: ["No Cover Author"],
						key: "/works/OL444W",
						isbn: ["9784444444444"],
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("9784444444444");

			expect(result).not.toBeNull();
			expect(result?.coverImageUrl).toBeUndefined();
			expect(result?.isbn13).toBe("9784444444444");
		});

		it("should handle ISBN-10 only", async () => {
			const mockResponse = {
				docs: [
					{
						title: "ISBN10 Book",
						author_name: ["ISBN10 Author"],
						key: "/works/OL555W",
						isbn: ["0123456789"], // Only ISBN-10
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("0123456789");

			expect(result).not.toBeNull();
			expect(result?.isbn10).toBe("0123456789");
			expect(result?.isbn13).toBeUndefined();
		});

		it("should handle ISBN-13 only", async () => {
			const mockResponse = {
				docs: [
					{
						title: "ISBN13 Book",
						author_name: ["ISBN13 Author"],
						key: "/works/OL666W",
						isbn: ["9780123456789"], // Only ISBN-13
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("9780123456789");

			expect(result).not.toBeNull();
			expect(result?.isbn13).toBe("9780123456789");
			expect(result?.isbn10).toBeUndefined();
		});

		it("should handle ISBNs with hyphens", async () => {
			const mockResponse = {
				docs: [
					{
						title: "Hyphen ISBN Book",
						author_name: ["Hyphen Author"],
						key: "/works/OL777W",
						isbn: ["978-0-12-345678-9", "0-12-345678-9"],
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByISBN("9780123456789");

			expect(result).not.toBeNull();
			// Should extract ISBNs correctly even with hyphens
			expect(result?.isbn10).toBe("0-12-345678-9");
			expect(result?.isbn13).toBe("978-0-12-345678-9");
		});

		it("should handle minimal book data", async () => {
			const mockResponse = {
				docs: [
					{
						title: "Minimal Book",
						author_name: ["Minimal Author"],
						key: "/works/OL888W",
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				json: async () => mockResponse,
			} as Response);

			const result = await searchBookByTitleAndAuthor(
				"Minimal Book",
				"Minimal Author",
			);

			expect(result).not.toBeNull();
			expect(result?.openLibraryWorkKey).toBe("/works/OL888W");
			expect(result?.enrichedAt).toBeDefined();
			// Most fields should be undefined for minimal data
			expect(result?.coverImageUrl).toBeUndefined();
			expect(result?.isbn10).toBeUndefined();
			expect(result?.numberOfPages).toBeUndefined();
		});
	});

	describe("work description fetching", () => {
		it("should populate description when works API returns a plain string", async () => {
			const searchResponse = {
				docs: [
					{
						title: "Described Book",
						author_name: ["Some Author"],
						key: "/works/OL999W",
					},
				],
			};
			const worksResponse = { description: "A plain string description." };

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => searchResponse,
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => worksResponse,
				} as Response);

			const result = await searchBookByTitleAndAuthor("Described Book", "Some Author");

			expect(result?.description).toBe("A plain string description.");
			expect(global.fetch).toHaveBeenCalledTimes(2);
			expect(global.fetch).toHaveBeenLastCalledWith(
				expect.stringContaining("/works/OL999W.json"),
			);
		});

		it("should populate description when works API returns an object with value", async () => {
			const searchResponse = {
				docs: [
					{
						title: "Described Book",
						author_name: ["Some Author"],
						key: "/works/OL999W",
					},
				],
			};
			const worksResponse = { description: { value: "An object description." } };

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => searchResponse,
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => worksResponse,
				} as Response);

			const result = await searchBookByTitleAndAuthor("Described Book", "Some Author");

			expect(result?.description).toBe("An object description.");
		});

		it("should leave description undefined when works API returns no description", async () => {
			const searchResponse = {
				docs: [
					{
						title: "Undescribed Book",
						author_name: ["Some Author"],
						key: "/works/OL999W",
					},
				],
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => searchResponse,
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({}),
				} as Response);

			const result = await searchBookByTitleAndAuthor("Undescribed Book", "Some Author");

			expect(result?.description).toBeUndefined();
		});

		it("should leave description undefined when works API request fails", async () => {
			const searchResponse = {
				docs: [
					{
						title: "Book With Failed Works Fetch",
						author_name: ["Some Author"],
						key: "/works/OL999W",
					},
				],
			};

			global.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: true,
					json: async () => searchResponse,
				} as Response)
				.mockResolvedValueOnce({
					ok: false,
				} as Response);

			const result = await searchBookByTitleAndAuthor(
				"Book With Failed Works Fetch",
				"Some Author",
			);

			expect(result?.description).toBeUndefined();
		});

		it("should not fetch description when book has no work key", async () => {
			const searchResponse = {
				docs: [
					{
						title: "No Key Book",
						author_name: ["Some Author"],
						// No key field
					},
				],
			};

			global.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				json: async () => searchResponse,
			} as Response);

			const result = await searchBookByTitleAndAuthor("No Key Book", "Some Author");

			expect(result?.description).toBeUndefined();
			expect(global.fetch).toHaveBeenCalledTimes(1);
		});
	});
});
