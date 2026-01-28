import OpenAI from "openai";
import { projectBranchState } from "../domain/projection";
import type {
	AppEvent,
	Branch,
	ItemStatusChangedEvent,
	RecommendationItem,
	ReflectionAddedEvent,
} from "../domain/types";
import { searchBook } from "./openlibrary";

// Initialize OpenAI only if key is present
const apiKey = process.env.OPENAI_API_KEY;
const openai = apiKey ? new OpenAI({ apiKey }) : null;

export async function generateRecommendations(
	branch: Branch,
	history: AppEvent[],
): Promise<RecommendationItem[]> {
	if (!openai) {
		console.warn("OPENAI_API_KEY not set, returning mock recommendations.");
		return [
			{
				title: "Mock Book 1",
				author: "Mock Author 1",
				reason: "Because you do not have an API key set.",
			},
			{
				title: "Mock Book 2",
				author: "Mock Author 2",
				reason: "Another mock reason.",
			},
		];
	}

	const state = projectBranchState(history);

	// Extract reflections from history
	const reflections = history.filter(
		(e): e is ReflectionAddedEvent => e.type === "REFLECTION_ADDED",
	);
	const reflectionsText =
		reflections.length > 0
			? reflections
					.map((r) => {
						if (r.payload.itemTitle) {
							return `On "${r.payload.itemTitle}": ${r.payload.content}`;
						}
						return r.payload.content;
					})
					.join("\n")
			: "None yet.";

	// Collect all existing titles for the prompt context
	const libraryTitles = state.library.map((b) => b.title);
	const inboxTitles = state.inbox.map((b) => b.title);
	const existingTitles = [...libraryTitles, ...inboxTitles];

	// Collect all existing ISBNs for precise duplicate filtering
	const existingIsbns = new Set<string>();
	for (const item of [...state.library, ...state.inbox]) {
		if (item.metadata?.isbn10) existingIsbns.add(item.metadata.isbn10);
		if (item.metadata?.isbn13) existingIsbns.add(item.metadata.isbn13);
	}

	const systemPrompt = `You are a helpful reading assistant. 
  The user is looking for something to read, described as: "${branch.description}".
  
  Context:
  - Books already in list (Do NOT recommend these again): ${existingTitles.join(", ")}
  - Rejected Books: ${history
		.filter(
			(e): e is ItemStatusChangedEvent =>
				e.type === "ITEM_STATUS_CHANGED" && e.payload.status === "REJECTED",
		)
		.map((e) => e.payload.itemTitle)
		.join(", ")}
  - User Reflections: ${reflectionsText}
  
  Please suggest 3-5 relevant books.
  For each book, provide:
  - title
  - author
  - reason (a brief explanation of why it fits what they're looking for)
  - isbn (if available - this helps with accurate book matching)
  
  Respond in JSON format with a list of objects under the key "items".
  `;

	const response = await openai.chat.completions.create({
		model: "gpt-4o",
		messages: [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: "Please provide recommendations." },
		],
		response_format: { type: "json_object" },
	});

	const content = response.choices[0].message.content;
	if (!content) {
		throw new Error("No content received from AI");
	}

	const result = JSON.parse(content);
	let items = result.items as RecommendationItem[];

	// Filter out duplicates based on ISBN ONLY
	// If the recommended item has no ISBN, we cannot determine if it's a duplicate, so we keep it.
	if (existingIsbns.size > 0) {
		items = items.filter((item) => {
			if (!item.isbn) return true; // Keep if no ISBN
			return !existingIsbns.has(item.isbn);
		});
	}

	// Enrich each recommendation with OpenLibrary metadata
	const enrichedItems = await Promise.all(
		items.map(async (item) => {
			try {
				const metadata = await searchBook(item.title, item.author, item.isbn);
				if (metadata) {
					return { ...item, metadata };
				}
				return item;
			} catch (error) {
				// If enrichment fails, continue without metadata
				console.error(`Failed to enrich book "${item.title}":`, error);
				return item;
			}
		}),
	);

	return enrichedItems;
}
