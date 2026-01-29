import type { APIRoute } from "astro";
import { v4 as uuidv4 } from "uuid";
import type { ItemStatus } from "../../../../domain/types";
import { addEvent, getBranch } from "../../../../lib/dal";
import {
	type OPDSCatalog,
	opdsCatalogToRecommendationItems,
} from "../../../../lib/opds";

export const POST: APIRoute = async ({ params, request }) => {
	const { slug } = params;
	if (!slug) {
		return new Response(JSON.stringify({ error: "Slug required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Verify branch exists
	const branch = await getBranch(slug);
	if (!branch) {
		return new Response(JSON.stringify({ error: "Branch not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		// Parse form data
		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const statusParam = formData.get("status")?.toString() || "ALREADY_READ";

		// Validate file
		if (!file) {
			return new Response(JSON.stringify({ error: "OPDS file is required" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate status
		const validStatuses: ItemStatus[] = [
			"PENDING",
			"ACCEPTED",
			"DEFERRED",
			"REJECTED",
			"ALREADY_READ",
		];
		const status = statusParam as ItemStatus;
		if (!validStatuses.includes(status)) {
			return new Response(
				JSON.stringify({
					error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Read and parse OPDS file
		const fileContent = await file.text();
		let catalog: OPDSCatalog;

		try {
			catalog = JSON.parse(fileContent);
		} catch (_error) {
			return new Response(JSON.stringify({ error: "Invalid JSON file" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Validate OPDS catalog structure
		if (!catalog.publications?.length || !Array.isArray(catalog.publications)) {
			return new Response(
				JSON.stringify({
					error: "Invalid OPDS catalog structure. Missing publications array.",
				}),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		// Convert OPDS catalog to RecommendationItem[]
		const items = opdsCatalogToRecommendationItems(catalog);

		if (items.length === 0) {
			return new Response(
				JSON.stringify({ error: "No valid books found in OPDS catalog" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const timestamp = new Date().toISOString();

		// Create RECOMMENDATIONS_GENERATED event
		await addEvent(slug, {
			id: uuidv4(),
			timestamp,
			type: "RECOMMENDATIONS_GENERATED",
			payload: {
				items,
				model: "opds-import",
			},
		});

		// If status is not PENDING, create ITEM_STATUS_CHANGED events for each book
		if (status !== "PENDING") {
			const statusChangePromises = items.map((item) =>
				addEvent(slug, {
					id: uuidv4(),
					timestamp: new Date().toISOString(),
					type: "ITEM_STATUS_CHANGED",
					payload: {
						itemTitle: item.title,
						status,
					},
				}),
			);

			await Promise.all(statusChangePromises);
		}

		return new Response(
			JSON.stringify({
				success: true,
				imported: items.length,
				status,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error importing OPDS catalog:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to import OPDS catalog",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
};
