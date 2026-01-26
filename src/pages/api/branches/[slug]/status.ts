import type { APIRoute } from "astro";
import { v4 as uuidv4 } from "uuid";
import { projectBranchState } from "../../../../domain/projection";
import type { ItemStatus } from "../../../../domain/types";
import { generateRecommendations } from "../../../../lib/ai";
import { addEvent, getBranch, getBranchEvents } from "../../../../lib/dal";

export const POST: APIRoute = async ({ params, request, redirect }) => {
	const { slug } = params;
	if (!slug) return new Response("Slug required", { status: 400 });

	const formData = await request.formData();
	const itemTitle = formData.get("itemTitle")?.toString();
	const status = formData.get("status")?.toString() as ItemStatus;
	const reflection = formData.get("reflection")?.toString();

	if (!itemTitle || !status) {
		return new Response("Missing itemTitle or status", { status: 400 });
	}

	// If reflection is provided, add it before the status change
	if (reflection && reflection.trim().length > 0) {
		await addEvent(slug, {
			id: uuidv4(),
			timestamp: new Date().toISOString(),
			type: "REFLECTION_ADDED",
			payload: {
				itemTitle,
				content: reflection.trim(),
			},
		});
	}

	await addEvent(slug, {
		id: uuidv4(),
		timestamp: new Date().toISOString(),
		type: "ITEM_STATUS_CHANGED",
		payload: {
			itemTitle,
			status,
		},
	});

	// Auto-generation logic
	// Check if we need to replenish recommendations
	// We do this asynchronously (fire and forget logic similar to generate.ts)
	(async () => {
		try {
			const events = await getBranchEvents(slug);
			const state = projectBranchState(events);

			// If inbox is running low (e.g., fewer than 2 items), generate more
			// Also check if we haven't just generated recently to avoid loops (though the inbox count check helps)
			if (state.inbox.length < 2) {
				console.log(
					`Inbox low (${state.inbox.length} items) for branch ${slug}, auto-generating...`,
				);

				const branch = await getBranch(slug);
				if (branch) {
					// Add REQUESTED event (system initiated)
					await addEvent(slug, {
						id: uuidv4(),
						timestamp: new Date().toISOString(),
						type: "RECOMMENDATIONS_REQUESTED",
						payload: { userNote: "Auto-generated due to low inbox" },
					});

					const items = await generateRecommendations(branch, events);

					await addEvent(slug, {
						id: uuidv4(),
						timestamp: new Date().toISOString(),
						type: "RECOMMENDATIONS_GENERATED",
						payload: {
							items,
							model: "gpt-4o",
						},
					});
				}
			}
		} catch (error) {
			console.error("Error in auto-generation:", error);
		}
	})();

	return redirect(`/branch/${slug}`);
};
