import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel/serverless";

// https://astro.build/config
export default defineConfig({
  site: 'https://www.thehermeticflight.com',
  output: 'hybrid',
  adapter: vercel(),
  integrations: [tailwind(), sitemap(), mdx()]
});
