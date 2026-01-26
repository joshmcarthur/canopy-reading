import type { APIContext } from "astro";
import { beforeEach, describe, expect, it } from "vitest";
import { projectBranchState } from "../../../src/domain/projection";
import { getBranchEvents } from "../../../src/lib/dal";
import {
	createMockRecommendation,
	createRecommendationsGeneratedEvent,
	createStatusChangedEvent,
	createTestBranch,
	resetStorage,
} from "../helpers";

describe("Status API Integration", () => {
	beforeEach(() => {
		resetStorage();
	});

	it("should return 400 if slug is missing", async () => {
		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book");
		formData.append("status", "ACCEPTED");
		const request = new Request("http://localhost/api/branches//status", {
			method: "POST",
			body: formData,
		});

		const response = await POST({
			params: {},
			request,
		} as APIContext);

		expect(response.status).toBe(400);
	});

	it("should return 400 if itemTitle or status is missing", async () => {
		const branch = await createTestBranch("Test Branch", "A test branch");

		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);

		// Missing itemTitle
		const formData1 = new FormData();
		formData1.append("status", "ACCEPTED");
		const request1 = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData1,
			},
		);

		const response1 = await POST({
			params: { slug: branch.slug },
			request: request1,
		} as APIContext);
		expect(response1.status).toBe(400);

		// Missing status
		const formData2 = new FormData();
		formData2.append("itemTitle", "Test Book");
		const request2 = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData2,
			},
		);

		const response2 = await POST({
			params: { slug: branch.slug },
			request: request2,
		} as APIContext);
		expect(response2.status).toBe(400);
	});

	it("should change item status from PENDING to ACCEPTED", async () => {
		const recommendations = [
			createMockRecommendation("Test Book", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const branch = await createTestBranch(
			"Test Branch Status",
			"A test branch",
			[generatedEvent],
		);

		// Verify initial state - book should be in inbox
		const eventsBefore = await getBranchEvents(branch.slug);
		const stateBefore = projectBranchState(eventsBefore);
		expect(stateBefore.inbox).toHaveLength(1);
		expect(stateBefore.inbox[0].title).toBe("Test Book");
		expect(stateBefore.inbox[0].status).toBe("PENDING");

		// Submit status change
		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book");
		formData.append("status", "ACCEPTED");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData,
			},
		);

		const response = await POST({
			params: { slug: branch.slug },
			request,
			redirect: (url: string) =>
				new Response(null, { status: 302, headers: { Location: url } }),
		} as APIContext);

		// Should redirect to branch page
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toContain(
			`/branch/${branch.slug}`,
		);

		// Verify state changed - book should be in library
		const eventsAfter = await getBranchEvents(branch.slug);
		const stateAfter = projectBranchState(eventsAfter);
		expect(stateAfter.inbox).toHaveLength(0);
		expect(stateAfter.library).toHaveLength(1);
		expect(stateAfter.library[0].title).toBe("Test Book");
		expect(stateAfter.library[0].status).toBe("ACCEPTED");
	});

	it("should change item status to DEFERRED", async () => {
		const recommendations = [
			createMockRecommendation("Test Book Deferred", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const branch = await createTestBranch(
			"Test Branch Deferred",
			"A test branch",
			[generatedEvent],
		);

		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book Deferred");
		formData.append("status", "DEFERRED");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData,
			},
		);

		const response = await POST({
			params: { slug: branch.slug },
			request,
			redirect: (url: string) =>
				new Response(null, { status: 302, headers: { Location: url } }),
		} as APIContext);

		expect(response.status).toBe(302);

		const events = await getBranchEvents(branch.slug);
		const state = projectBranchState(events);
		expect(state.library).toHaveLength(1);
		expect(state.library[0].status).toBe("DEFERRED");
	});

	it("should change item status to REJECTED", async () => {
		const recommendations = [
			createMockRecommendation("Test Book Rejected", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const branch = await createTestBranch(
			"Test Branch Rejected",
			"A test branch",
			[generatedEvent],
		);

		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book Rejected");
		formData.append("status", "REJECTED");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData,
			},
		);

		const response = await POST({
			params: { slug: branch.slug },
			request,
			redirect: (url: string) =>
				new Response(null, { status: 302, headers: { Location: url } }),
		} as APIContext);

		expect(response.status).toBe(302);

		const events = await getBranchEvents(branch.slug);
		const state = projectBranchState(events);
		// Rejected items should not be in library
		expect(state.library).toHaveLength(0);
		expect(state.inbox).toHaveLength(0);
	});

	it("should add reflection when provided", async () => {
		const recommendations = [
			createMockRecommendation("Test Book Reflection", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const acceptedEvent = createStatusChangedEvent(
			"Test Book Reflection",
			"ACCEPTED",
		);
		const branch = await createTestBranch(
			"Test Branch Reflection",
			"A test branch",
			[generatedEvent, acceptedEvent],
		);

		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book Reflection");
		formData.append("status", "ALREADY_READ");
		formData.append("reflection", "This was a great book!");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData,
			},
		);

		const response = await POST({
			params: { slug: branch.slug },
			request,
			redirect: (url: string) =>
				new Response(null, { status: 302, headers: { Location: url } }),
		} as APIContext);

		expect(response.status).toBe(302);

		const events = await getBranchEvents(branch.slug);
		const reflectionEvents = events.filter(
			(e) => e.type === "REFLECTION_ADDED",
		);
		expect(reflectionEvents).toHaveLength(1);
		expect(reflectionEvents[0].payload.content).toBe("This was a great book!");
		expect(reflectionEvents[0].payload.itemTitle).toBe("Test Book Reflection");

		// Status should also be changed
		const state = projectBranchState(events);
		expect(state.library).toHaveLength(1);
		expect(state.library[0].status).toBe("ALREADY_READ");
	});

	it("should change status from DEFERRED to ACCEPTED", async () => {
		const recommendations = [
			createMockRecommendation("Test Book Status Change", "Author", "Reason"),
		];

		const generatedEvent = createRecommendationsGeneratedEvent(recommendations);
		const deferredEvent = createStatusChangedEvent(
			"Test Book Status Change",
			"DEFERRED",
		);
		const branch = await createTestBranch(
			"Test Branch Status Change",
			"A test branch",
			[generatedEvent, deferredEvent],
		);

		// Book should be in library with DEFERRED status
		let events = await getBranchEvents(branch.slug);
		let state = projectBranchState(events);
		expect(state.library).toHaveLength(1);
		expect(state.library[0].status).toBe("DEFERRED");

		// Change to ACCEPTED
		const { POST } = await import(
			"../../../src/pages/api/branches/[slug]/status"
		);
		const formData = new FormData();
		formData.append("itemTitle", "Test Book Status Change");
		formData.append("status", "ACCEPTED");
		const request = new Request(
			`http://localhost/api/branches/${branch.slug}/status`,
			{
				method: "POST",
				body: formData,
			},
		);

		const response = await POST({
			params: { slug: branch.slug },
			request,
			redirect: (url: string) =>
				new Response(null, { status: 302, headers: { Location: url } }),
		} as APIContext);

		expect(response.status).toBe(302);

		events = await getBranchEvents(branch.slug);
		state = projectBranchState(events);
		expect(state.library).toHaveLength(1);
		expect(state.library[0].status).toBe("ACCEPTED");
	});
});
