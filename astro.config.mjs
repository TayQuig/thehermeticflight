import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import sitemap from "@astrojs/sitemap"; // <--- 1. Import the library

import mdx from "@astrojs/mdx";

// https://astro.build/config
export default defineConfig({
  site: 'https://www.thehermeticflight.com', // <--- 2. Define your domain (Required)
  integrations: [tailwind(), sitemap(), mdx()] // <--- 3. Activate the plugin
});