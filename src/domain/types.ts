export type EventType =
	| "BRANCH_CREATED"
	| "RECOMMENDATIONS_REQUESTED"
	| "RECOMMENDATIONS_GENERATED"
	| "ITEM_STATUS_CHANGED"
	| "REFLECTION_ADDED"
	| "BRANCH_FORKED";

export interface BaseEvent {
	id: string;
	timestamp: string;
	type: EventType;
}

export interface BranchCreatedEvent extends BaseEvent {
	type: "BRANCH_CREATED";
	payload: {
		name: string;
		description: string;
	};
}

export interface RecommendationsRequestedEvent extends BaseEvent {
	type: "RECOMMENDATIONS_REQUESTED";
	payload: {
		userNote?: string;
	};
}

export interface BookMetadata {
	coverImageUrl?: string;
	coverImageSmallUrl?: string;
	coverImageMediumUrl?: string;
	coverImageLargeUrl?: string;
	isbn10?: string;
	isbn13?: string;
	description?: string;
	firstPublishYear?: number;
	publishDate?: string;
	numberOfPages?: number;
	publisher?: string[];
	language?: string[];
	openLibraryWorkKey?: string;
	openLibraryEditionKey?: string;
	authorKeys?: string[];
	enrichedAt?: string; // ISO timestamp
}

export interface RecommendationItem {
	title: string;
	author: string;
	reason: string;
	isbn?: string; // ISBN provided by AI (if available)
	metadata?: BookMetadata; // Enriched metadata from OpenLibrary
}

export interface RecommendationsGeneratedEvent extends BaseEvent {
	type: "RECOMMENDATIONS_GENERATED";
	payload: {
		items: RecommendationItem[];
		model: string;
	};
}

export type ItemStatus =
	| "PENDING"
	| "ACCEPTED"
	| "DEFERRED"
	| "REJECTED"
	| "ALREADY_READ";

export interface ItemStatusChangedEvent extends BaseEvent {
	type: "ITEM_STATUS_CHANGED";
	payload: {
		itemTitle: string;
		status: ItemStatus;
	};
}

export interface ReflectionAddedEvent extends BaseEvent {
	type: "REFLECTION_ADDED";
	payload: {
		itemTitle?: string; // If null, reflection is on the branch
		content: string;
	};
}

export interface BranchForkedEvent extends BaseEvent {
	type: "BRANCH_FORKED";
	payload: {
		sourceBranchId: string;
		newBranchName: string;
		reason: string;
	};
}

export type AppEvent =
	| BranchCreatedEvent
	| RecommendationsRequestedEvent
	| RecommendationsGeneratedEvent
	| ItemStatusChangedEvent
	| ReflectionAddedEvent
	| BranchForkedEvent;

export interface Branch {
	id: string;
	slug: string;
	name: string;
	description: string;
	createdAt: string;
}

export interface BookItem {
	title: string;
	author: string;
	reason: string;
	status: ItemStatus;
	addedAt: string; // ISO8601
	metadata?: BookMetadata; // Enriched metadata from OpenLibrary
}

export interface BranchState {
	inbox: BookItem[];
	library: BookItem[];
	history: AppEvent[];
	// Context could be a computed property or stored here.
	// For now, we will derive it from history when needed, or store relevant context summaries here.
	// The plan mentions "context: The accumulated context window for the next AI call."
	// Let's keep it simple for now and rely on inbox/library/history.
}
