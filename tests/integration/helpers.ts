import type { APIContext, Params } from "astro";
import { createContext } from "astro/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
	AppEvent,
	Branch,
	RecommendationItem,
} from "../../src/domain/types";
import { addEvent, createBranch } from "../../src/lib/dal";
import { getAdapter, resetAdapter } from "../../src/lib/dal/factory";

/**
 * Create a test branch with optional initial events.
 */
export async function createTestBranch(
	name: string,
	description: string,
	initialEvents: AppEvent[] = [],
): Promise<Branch> {
	const branch = await createBranch(name, description);

	// Add initial events if provided
	for (const event of initialEvents) {
		await addEvent(branch.slug, event);
	}

	return branch;
}

/**
 * Create a mock recommendation item for testing.
 */
export function createMockRecommendation(
	title: string,
	author: string,
	reason: string,
	metadata?: RecommendationItem["metadata"],
): RecommendationItem {
	return {
		title,
		author,
		reason,
		metadata,
	};
}

/**
 * Create a RECOMMENDATIONS_GENERATED event.
 */
export function createRecommendationsGeneratedEvent(
	items: RecommendationItem[],
	timestamp?: string,
): AppEvent {
	return {
		id: uuidv4(),
		timestamp: timestamp || new Date().toISOString(),
		type: "RECOMMENDATIONS_GENERATED",
		payload: {
			items,
			model: "gpt-4o",
		},
	};
}

/**
 * Create an ITEM_STATUS_CHANGED event.
 */
export function createStatusChangedEvent(
	itemTitle: string,
	status: "ACCEPTED" | "DEFERRED" | "REJECTED" | "ALREADY_READ",
	timestamp?: string,
): AppEvent {
	return {
		id: uuidv4(),
		timestamp: timestamp || new Date().toISOString(),
		type: "ITEM_STATUS_CHANGED",
		payload: {
			itemTitle,
			status,
		},
	};
}

/**
 * Create a REFLECTION_ADDED event.
 */
export function createReflectionEvent(
	content: string,
	itemTitle?: string,
	timestamp?: string,
): AppEvent {
	return {
		id: uuidv4(),
		timestamp: timestamp || new Date().toISOString(),
		type: "REFLECTION_ADDED",
		payload: {
			content,
			itemTitle,
		},
	};
}

/**
 * Storage adapter with optional clear method for testing
 */
interface ClearableAdapter {
	clear?: () => void;
}

/**
 * Reset the storage adapter (clears all data).
 */
export function resetStorage(): void {
	// First, clear the existing adapter if it exists
	const existingAdapter = getAdapter();
	if (
		"clear" in existingAdapter &&
		typeof existingAdapter.clear === "function"
	) {
		(existingAdapter as ClearableAdapter).clear?.();
	}
	// Then reset the adapter instance so a fresh one is created
	resetAdapter();
	// Set environment to ensure memory adapter is used
	process.env.CANOPY_STORAGE_ADAPTER = "memory";
}

/**
 * Check if HTML contains specific text.
 */
export function htmlContains(html: string, text: string): boolean {
	return (
		html.includes(text) ||
		html
			.replace(/<[^>]*>/g, " ")
			.replace(/\s+/g, " ")
			.includes(text)
	);
}

/**
 * Create an APIContext for testing API routes.
 * Provides sensible defaults for required fields.
 */
export function createTestContext(options: {
	params?: Params;
	request?: Request;
	locals?: App.Locals;
}): APIContext {
	return createContext({
		params: options.params ?? {},
		request: options.request ?? new Request("http://localhost"),
		defaultLocale: "en-US",
		locals: options.locals ?? {},
	});
}
