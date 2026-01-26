import type {
	AppEvent,
	BookItem,
	BranchState,
	RecommendationItem,
} from "./types";

export function projectBranchState(events: AppEvent[]): BranchState {
	const state: BranchState = {
		inbox: [],
		library: [],
		history: [],
	};

	// Sort events by timestamp if not already sorted?
	// We assume the DAL returns them in sequence order (which is usually chronological).
	// DAL sorts by filename which includes sequence number.

	for (const event of events) {
		state.history.push(event);

		switch (event.type) {
			case "RECOMMENDATIONS_GENERATED": {
				const payload = event.payload;
				// Add new items to inbox
				const newItems: BookItem[] = payload.items.map(
					(item: RecommendationItem) => ({
						title: item.title,
						author: item.author,
						reason: item.reason,
						status: "PENDING",
						addedAt: event.timestamp,
						metadata: item.metadata, // Preserve metadata from enrichment
					}),
				);

				// Check for duplicates? For now, just add.
				state.inbox.push(...newItems);
				break;
			}

			case "ITEM_STATUS_CHANGED": {
				const { itemTitle, status } = event.payload;

				// Find in inbox first
				const inboxIndex = state.inbox.findIndex(
					(item) => item.title === itemTitle,
				);
				if (inboxIndex !== -1) {
					const item = state.inbox[inboxIndex];
					// Remove from inbox
					state.inbox.splice(inboxIndex, 1);

					if (
						status === "ACCEPTED" ||
						status === "DEFERRED" ||
						status === "ALREADY_READ"
					) {
						// Move to library with new status
						item.status = status;
						state.library.push(item);
					} else if (status === "REJECTED") {
						// Just remove from inbox, or maybe keep in library as rejected?
						// Plan: "library: Books accepted/reading/read."
						// "Rejected" probably shouldn't be in library view, but might be useful for context.
						// We'll not add to library if rejected.
					}
				} else {
					// Check if it's already in library (e.g. changing from DEFERRED to ACCEPTED)
					const libraryItem = state.library.find(
						(item) => item.title === itemTitle,
					);
					if (libraryItem) {
						if (status === "REJECTED") {
							state.library = state.library.filter(
								(i) => i.title !== itemTitle,
							);
						} else {
							libraryItem.status = status;
						}
					}
				}
				break;
			}

			// Other events don't modify inbox/library state directly
		}
	}

	return state;
}
