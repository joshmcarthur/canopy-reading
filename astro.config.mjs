import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
// @ts-check
import { defineConfig, passthroughImageService } from "astro/config";

// https://astro.build/config
// Note: To deploy to Cloudflare, replace @astrojs/node with @astrojs/cloudflare
// and set CANOPY_STORAGE_ADAPTER=cloudflare environment variable.
// The Cloudflare adapter requires Durable Object bindings (see wrangler.toml).

// Parse allowedDomains from environment variable (optional)
// Format: JSON array, e.g. '[{"hostname":"**.example.com","protocol":"https"},{"hostname":"staging.myapp.com","protocol":"https","port":"443"}]'
let allowedDomains = [];
if (process.env.SECURITY_ALLOWED_DOMAINS) {
	try {
		allowedDomains = JSON.parse(process.env.SECURITY_ALLOWED_DOMAINS);
	} catch (error) {
		console.warn(
			"Failed to parse SECURITY_ALLOWED_DOMAINS environment variable:",
			error,
		);
	}
}

export default defineConfig({
	output: "server",
	image: {
		service: passthroughImageService(),
	},
	adapter: node({
		mode: "standalone",
	}),
	vite: {
		plugins: [tailwindcss()],
	},
	security: {
		// Disable CSRF origin check - required when behind reverse proxy
		// This allows same-origin POST requests to work correctly
		checkOrigin: false,
		// Optionally include allowedDomains if SECURITY_ALLOWED_DOMAINS is set
		...(allowedDomains.length > 0 && { allowedDomains }),
	},
});
