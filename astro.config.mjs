import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import vercel from "@astrojs/vercel";

// https://astro.build/config
export default defineConfig({
  site: 'https://www.thehermeticflight.com',
  output: 'static',
  adapter: vercel(),
  integrations: [tailwind(), sitemap(), mdx()]
});
