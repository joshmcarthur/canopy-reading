import type {
	ChatCompletionCreateParams,
	ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	AppEvent,
	Branch,
	ItemStatusChangedEvent,
	ReflectionAddedEvent,
} from "../src/domain/types";

// Mock OpenLibrary search
vi.mock("../src/lib/openlibrary", () => ({
	searchBook: vi.fn().mockResolvedValue({
		coverImageUrl: "http://example.com/cover.jpg",
	}),
}));

// Mock OpenAI module
const mockChatCompletionsCreate = vi.fn();
vi.mock("openai", () => {
	return {
		default: vi.fn().mockImplementation(() => ({
			chat: {
				completions: {
					create: mockChatCompletionsCreate,
				},
			},
		})),
	};
});

describe("AI Integration", () => {
	const originalKey = process.env.OPENAI_API_KEY;

	beforeEach(() => {
		// Reset mock before each test
		mockChatCompletionsCreate.mockReset();
		mockChatCompletionsCreate.mockResolvedValue({
			choices: [
				{
					message: {
						content: JSON.stringify({
							items: [
								{
									title: "Test Book",
									author: "Test Author",
									reason: "Test reason",
									isbn: "1234567890",
								},
							],
						}),
					},
				},
			],
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
		if (originalKey) {
			process.env.OPENAI_API_KEY = originalKey;
		} else {
			process.env.OPENAI_API_KEY = undefined;
		}
	});

	it("should return mock recommendations when API key is missing", async () => {
		// Import after mocking OpenAI
		const { generateRecommendations } = await import("../src/lib/ai");

		const branch: Branch = {
			id: "1",
			slug: "test-branch",
			name: "Test Branch",
			description: "Test Description",
			createdAt: new Date().toISOString(),
		};
		const history: AppEvent[] = [];

		// Ensure API Key is unset
		process.env.OPENAI_API_KEY = undefined;

		const items = await generateRecommendations(branch, history);
		expect(items).toHaveLength(2);
		expect(items[0].title).toContain("Mock");
	});

	describe("Reflections in AI prompt", () => {
		const branch: Branch = {
			id: "1",
			slug: "test-branch",
			name: "Test Branch",
			description: "Test Description",
			createdAt: new Date().toISOString(),
		};

		beforeEach(async () => {
			// Set API key so we test the actual OpenAI path
			process.env.OPENAI_API_KEY = "test-key";
			// Reset modules to ensure the API key is picked up
			vi.resetModules();
		});

		it('should include "None yet." when no reflections exist', async () => {
			const { generateRecommendations } = await import("../src/lib/ai");
			const history: AppEvent[] = [];

			await generateRecommendations(branch, history);

			expect(mockChatCompletionsCreate).toHaveBeenCalled();
			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain("User Reflections: None yet.");
		});

		it("should include branch-level reflection in prompt", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");
			const reflection: ReflectionAddedEvent = {
				id: "ref-1",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					content: "I love historical fiction with strong female protagonists",
				},
			};
			const history: AppEvent[] = [reflection];

			await generateRecommendations(branch, history);

			expect(mockChatCompletionsCreate).toHaveBeenCalled();
			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain("User Reflections:");
			expect(systemPrompt).toContain(
				"I love historical fiction with strong female protagonists",
			);
			expect(systemPrompt).not.toContain('On "');
		});

		it("should include book-specific reflection in prompt with book title", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");
			const reflection: ReflectionAddedEvent = {
				id: "ref-1",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					itemTitle: "The Test Book",
					content: "This book had amazing character development",
				},
			};
			const history: AppEvent[] = [reflection];

			await generateRecommendations(branch, history);

			expect(mockChatCompletionsCreate).toHaveBeenCalled();
			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain("User Reflections:");
			expect(systemPrompt).toContain(
				'On "The Test Book": This book had amazing character development',
			);
		});

		it("should include multiple reflections in prompt", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");
			const reflection1: ReflectionAddedEvent = {
				id: "ref-1",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					content: "I prefer shorter books",
				},
			};
			const reflection2: ReflectionAddedEvent = {
				id: "ref-2",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					itemTitle: "Book A",
					content: "Great pacing",
				},
			};
			const reflection3: ReflectionAddedEvent = {
				id: "ref-3",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					itemTitle: "Book B",
					content: "Too slow for my taste",
				},
			};
			const history: AppEvent[] = [reflection1, reflection2, reflection3];

			await generateRecommendations(branch, history);

			expect(mockChatCompletionsCreate).toHaveBeenCalled();
			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain("User Reflections:");
			expect(systemPrompt).toContain("I prefer shorter books");
			expect(systemPrompt).toContain('On "Book A": Great pacing');
			expect(systemPrompt).toContain('On "Book B": Too slow for my taste');
		});

		it("should filter out non-reflection events when extracting reflections", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");
			const reflection: ReflectionAddedEvent = {
				id: "ref-1",
				timestamp: new Date().toISOString(),
				type: "REFLECTION_ADDED",
				payload: {
					content: "Only this reflection should appear",
				},
			};
			const otherEvent: AppEvent = {
				id: "other-1",
				timestamp: new Date().toISOString(),
				type: "RECOMMENDATIONS_REQUESTED",
				payload: {},
			};
			const history: AppEvent[] = [reflection, otherEvent];

			await generateRecommendations(branch, history);

			expect(mockChatCompletionsCreate).toHaveBeenCalled();
			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain("Only this reflection should appear");
			expect(systemPrompt).not.toContain("RECOMMENDATIONS_REQUESTED");
		});
	});

	describe("Duplicate Removal", () => {
		const branch: Branch = {
			id: "1",
			slug: "test-branch",
			name: "Test Branch",
			description: "Test Description",
			createdAt: new Date().toISOString(),
		};

		beforeEach(async () => {
			process.env.OPENAI_API_KEY = "test-key";
			vi.resetModules();
		});

		it("should include existing books in the system prompt", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");

			// 1. Generate "Existing Book 1" -> adds to inbox
			const eventGen1: AppEvent = {
				id: "gen-1",
				timestamp: "2023-01-01T00:00:00Z",
				type: "RECOMMENDATIONS_GENERATED",
				payload: {
					items: [
						{
							title: "Existing Book 1",
							author: "Author 1",
							reason: "Reason 1",
						},
					],
					model: "gpt-4o",
				},
			};
			// 2. Accept "Existing Book 1" -> moves to library
			const eventAccept1: ItemStatusChangedEvent = {
				id: "accept-1",
				timestamp: "2023-01-02T00:00:00Z",
				type: "ITEM_STATUS_CHANGED",
				payload: {
					itemTitle: "Existing Book 1",
					status: "ACCEPTED",
				},
			};
			// 3. Generate "Pending Book 2" -> adds to inbox
			const eventGen2: AppEvent = {
				id: "gen-2",
				timestamp: "2023-01-03T00:00:00Z",
				type: "RECOMMENDATIONS_GENERATED",
				payload: {
					items: [
						{
							title: "Pending Book 2",
							author: "Author 2",
							reason: "Reason 2",
						},
					],
					model: "gpt-4o",
				},
			};

			const history: AppEvent[] = [eventGen1, eventAccept1, eventGen2];

			// Mock OpenAI response
			mockChatCompletionsCreate.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify({ items: [] }),
						},
					},
				],
			});

			await generateRecommendations(branch, history);

			const callArgs = mockChatCompletionsCreate.mock
				.calls[0][0] as ChatCompletionCreateParams;
			const systemPrompt = callArgs.messages.find(
				(m: ChatCompletionMessageParam) => m.role === "system",
			)?.content;

			expect(systemPrompt).toContain(
				"Books already in list (Do NOT recommend these again):",
			);
			expect(systemPrompt).toContain("Existing Book 1");
			expect(systemPrompt).toContain("Pending Book 2");
		});

		it("should filter out duplicates from OpenAI response", async () => {
			const { generateRecommendations } = await import("../src/lib/ai");

			// 1. Generate "Existing Book 1" -> adds to inbox
			const eventGen1: AppEvent = {
				id: "gen-1",
				timestamp: "2023-01-01T00:00:00Z",
				type: "RECOMMENDATIONS_GENERATED",
				payload: {
					items: [
						{
							title: "Existing Book 1",
							author: "Author 1",
							reason: "Reason 1",
						},
					],
					model: "gpt-4o",
				},
			};
			// 2. Accept "Existing Book 1" -> moves to library
			const eventAccept1: ItemStatusChangedEvent = {
				id: "accept-1",
				timestamp: "2023-01-02T00:00:00Z",
				type: "ITEM_STATUS_CHANGED",
				payload: {
					itemTitle: "Existing Book 1",
					status: "ACCEPTED",
				},
			};
			// 3. Generate "Pending Book 2" -> adds to inbox
			const eventGen2: AppEvent = {
				id: "gen-2",
				timestamp: "2023-01-03T00:00:00Z",
				type: "RECOMMENDATIONS_GENERATED",
				payload: {
					items: [
						{
							title: "Pending Book 2",
							author: "Author 2",
							reason: "Reason 2",
						},
					],
					model: "gpt-4o",
				},
			};

			const history: AppEvent[] = [eventGen1, eventAccept1, eventGen2];

			// Mock OpenAI response returning duplicates
			mockChatCompletionsCreate.mockResolvedValue({
				choices: [
					{
						message: {
							content: JSON.stringify({
								items: [
									{
										title: "Existing Book 1",
										author: "Author 1",
										reason: "Reason 1",
									}, // Duplicate from Library
									{
										title: "pending book 2",
										author: "Author 2",
										reason: "Reason 2",
									}, // Duplicate from Inbox (case insensitive check)
									{
										title: "New Book 3",
										author: "Author 3",
										reason: "Reason 3",
									}, // New book
								],
							}),
						},
					},
				],
			});

			const recommendations = await generateRecommendations(branch, history);

			expect(recommendations).toHaveLength(1);
			expect(recommendations[0].title).toBe("New Book 3");
		});
	});
});
