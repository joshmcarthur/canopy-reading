import { beforeEach, describe, expect, it } from "vitest";
import { projectBranchState } from "../../../src/domain/projection";
import { getBranchEvents } from "../../../src/lib/dal";
import {
	createMockRecommendation,
	createRecommendationsGeneratedEvent,
	createStatusChangedEvent,
	createTestBranch,
	createTestContext,
	resetStorage,
} from "../helpers";

describe("Reflect Page Integration", () => {
	beforeEach(() => {
		resetStorage();
	});

	it("should fetch branch data for reflection page", async () => {
		const branch = await createTestBranch("Test Branch", "A test branch");

		const { GET } = await import(
			"../../../src/pages/api/branches/[slug]/state"
		);
		const response = await GET(
			createTestContext({
				params: { slug: branch.slug },
				request: new Request("http://localhost"),
			}),
		);

		expect(response.status).toBe(200);
		const state = await response.json();
		expect(state).toHaveProperty("inbox");
		expect(state).toHaveProperty("library");
	});

	it("should fetch book data when itemTitle is provided", async () => {
		const branch = await createTestBranch("Test Branch", "A test branch");

		const recommendations = [
			createMockRecommendation("Test Book", "Author", "Reason", {
				coverImageUrl: "https://example.com/cover.jpg",
			}),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent("Test Book", "ACCEPTED");

		await createTestBranch(branch.name, branch.description, [
			generatedEvent,
			acceptedEvent,
		]);

		const events = await getBranchEvents(branch.slug);
		const state = projectBranchState(events);

		const bookItem = [...state.library, ...state.inbox].find(
			(item) => item.title === "Test Book",
		);
		expect(bookItem).toBeDefined();
		expect(bookItem?.metadata?.coverImageUrl).toBe(
			"https://example.com/cover.jpg",
		);
	});

	it("should submit branch reflection via API", async () => {
		const branch = await createTestBranch("Test Branch", "A test branch");

		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/reflection"
		);
		const formData = new FormData();
		formData.append("content", "This is my reflection on the branch.");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/reflection`,
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

		// Should redirect to branch page
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain(
			`/branch/${branch.slug}`,
		);

		// Verify reflection was added
		const events = await getBranchEvents(branch.slug);
		const reflectionEvents = events.filter(
			(e) => e.type === "REFLECTION_ADDED",
		);
		// Find the most recent reflection event
		const latestReflection = reflectionEvents[reflectionEvents.length - 1];
		expect(latestReflection).toBeDefined();
		expect(latestReflection.payload.content).toBe(
			"This is my reflection on the branch.",
		);
		expect(latestReflection.payload.itemTitle).toBeUndefined();
	});

	it("should submit book reflection with status change", async () => {
		const branch = await createTestBranch("Test Branch", "A test branch");

		const recommendations = [
			createMockRecommendation("Test Book", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent("Test Book", "ACCEPTED");

		await createTestBranch(branch.name, branch.description, [
			generatedEvent,
			acceptedEvent,
		]);

		// Submit reflection with status change
		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book");
		formData.append("status", "ALREADY_READ");
		formData.append("reflection", "I really enjoyed this book!");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
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

		expect(response.status).toBe(302);

		// Verify reflection was added
		const events = await getBranchEvents(branch.slug);
		const reflectionEvents = events.filter(
			(e) => e.type === "REFLECTION_ADDED",
		);
		// Find the reflection for this specific book
		const bookReflection = reflectionEvents.find(
			(e) =>
				e.payload.itemTitle === "Test Book" &&
				e.payload.content === "I really enjoyed this book!",
		);
		expect(bookReflection).toBeDefined();
		expect(bookReflection?.payload.content).toBe("I really enjoyed this book!");
		expect(bookReflection?.payload.itemTitle).toBe("Test Book");
	});
});
