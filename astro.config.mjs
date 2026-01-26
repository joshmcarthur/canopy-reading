import node from "@astrojs/node";
import tailwind from "@astrojs/tailwind";
// @ts-check
import { defineConfig, passthroughImageService } from "astro/config";

// https://astro.build/config
// Note: To deploy to Cloudflare, replace @astrojs/node with @astrojs/cloudflare
// and set CANOPY_STORAGE_ADAPTER=cloudflare environment variable.
// The Cloudflare adapter requires Durable Object bindings (see wrangler.toml).
export default defineConfig({
	output: "server",
	image: {
		service: passthroughImageService(),
	},
	adapter: node({
		mode: "standalone",
	}),
	integrations: [tailwind()],
});
