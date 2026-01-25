// @ts-check
import { defineConfig, passthroughImageService } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  image: {
    service: passthroughImageService()
  },
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [tailwind()],
});
