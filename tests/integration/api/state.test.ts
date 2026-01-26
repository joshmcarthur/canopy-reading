import type { APIContext } from "astro";
import { beforeEach, describe, expect, it } from "vitest";
import type { BookItem } from "../../../src/domain/types";
import {
	createMockRecommendation,
	createRecommendationsGeneratedEvent,
	createStatusChangedEvent,
	createTestBranch,
	resetStorage,
} from "../helpers";

describe("State API Integration", () => {
	beforeEach(() => {
		resetStorage();
	});

	it("should return 400 if slug is missing", async () => {
		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);

		const response = await GET({
			params: {},
		} as APIContext);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Slug required");
	});

	it("should return state for existing branch", async () => {
		const recommendations = [
			createMockRecommendation("Book 1", "Author 1", "Reason 1"),
			createMockRecommendation("Book 2", "Author 2", "Reason 2"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent("Book 1", "ACCEPTED");

		const branch = await createTestBranch(
			"State Test Branch",
			"A test branch",
			[generatedEvent, acceptedEvent],
		);

		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);

		const response = await GET({
			params: { slug: branch.slug },
		} as APIContext);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/json");

		const state = await response.json();

		expect(state).toHaveProperty("inbox");
		expect(state).toHaveProperty("library");
		expect(state).toHaveProperty("historyCount");

		// Should have 1 item in inbox (Book 2 is still pending)
		expect(state.inbox).toHaveLength(1);
		expect(state.inbox[0].title).toBe("Book 2");

		// Should have 1 item in library (Book 1 was accepted)
		expect(state.library).toHaveLength(1);
		expect(state.library[0].title).toBe("Book 1");
		expect(state.library[0].status).toBe("ACCEPTED");

		// Should have 3 events (BRANCH_CREATED + generated + status changed)
		expect(state.historyCount).toBe(3);
	});

	it("should return empty state for branch with no events", async () => {
		const branch = await createTestBranch(
			"Empty State Branch",
			"A branch with no events",
		);

		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);

		const response = await GET({
			params: { slug: branch.slug },
		} as APIContext);

		const state = await response.json();

		expect(state.inbox).toHaveLength(0);
		expect(state.library).toHaveLength(0);
		// BRANCH_CREATED event is created when branch is created
		expect(state.historyCount).toBe(1);
	});

	it("should correctly project state with multiple status changes", async () => {
		const recommendations = [
			createMockRecommendation("Book A", "Author A", "Reason A"),
			createMockRecommendation("Book B", "Author B", "Reason B"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedA = createStatusChangedEvent("Book A", "ACCEPTED");
		const deferredB = createStatusChangedEvent("Book B", "DEFERRED");
		const readA = createStatusChangedEvent("Book A", "ALREADY_READ");

		const branch = await createTestBranch(
			"State Multi Change Branch",
			"A test branch",
			[generatedEvent, acceptedA, deferredB, readA],
		);

		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);

		const response = await GET({
			params: { slug: branch.slug },
		} as APIContext);

		const state = await response.json();

		// Book A should be in library with ALREADY_READ status
		const bookA = state.library.find((b: BookItem) => b.title === "Book A");
		expect(bookA).toBeDefined();
		expect(bookA?.status).toBe("ALREADY_READ");

		// Book B should be in library with DEFERRED status
		const bookB = state.library.find((b: BookItem) => b.title === "Book B");
		expect(bookB).toBeDefined();
		expect(bookB?.status).toBe("DEFERRED");

		// Inbox should be empty (both books moved to library)
		expect(state.inbox).toHaveLength(0);
	});

	it("should handle rejected items correctly", async () => {
		const recommendations = [
			createMockRecommendation("Accepted Book", "Author", "Reason"),
			createMockRecommendation("Rejected Book", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent("Accepted Book", "ACCEPTED");
		const rejectedEvent = createStatusChangedEvent("Rejected Book", "REJECTED");

		const branch = await createTestBranch(
			"State Rejected Branch",
			"A test branch",
			[generatedEvent, acceptedEvent, rejectedEvent],
		);

		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);

		const response = await GET({
			params: { slug: branch.slug },
		} as APIContext);

		const state = await response.json();

		// Accepted book should be in library
		expect(state.library).toHaveLength(1);
		expect(state.library[0].title).toBe("Accepted Book");

		// Rejected book should not be in library or inbox
		expect(state.inbox).toHaveLength(0);
		const rejectedInLibrary = state.library.find(
			(b: BookItem) => b.title === "Rejected Book",
		);
		expect(rejectedInLibrary).toBeUndefined();
	});
});
