/* empty css                                  */
import { c as createAstro, a as createComponent, m as maybeRenderHead, b as addAttribute, r as renderComponent, d as renderTemplate } from '../chunks/astro/server_EKTnqeOm.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_CeRGXfYN.mjs';
import { $ as $$Image } from '../chunks/_astro_assets_w1CU3Cd8.mjs';
import { g as getCollection } from '../chunks/_astro_content_B6aE7jDv.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.thehermeticflight.com");
const $$BlogCard = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$BlogCard;
  const { post } = Astro2.props;
  const formattedDate = post.data.pubDate.toLocaleDateString("en-us", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  return renderTemplate`${maybeRenderHead()}<a${addAttribute(`/blog/${post.slug}/`, "href")} class="group block h-full"> <article class="bg-indigo-950/30 border border-white/10 rounded-lg overflow-hidden h-full transition-transform duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.15)] flex flex-col"> ${post.data.heroImage && renderTemplate`<div class="aspect-video overflow-hidden relative"> ${renderComponent($$result, "Image", $$Image, { "src": post.data.heroImage, "alt": post.data.heroImageAlt || "", "class": "object-cover w-full h-full transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100", "width": 600, "height": 338 })} <!-- Subtle overlay gradient for better text readability if title overlaps --> <div class="absolute inset-0 bg-gradient-to-t from-indigo-950/80 to-transparent"></div> </div>`} <div class="p-6 flex flex-col flex-grow"> <div class="flex items-center gap-x-4 text-xs text-indigo-300 mb-3"> <time${addAttribute(post.data.pubDate.toISOString(), "datetime")}>${formattedDate}</time> ${post.data.tags && renderTemplate`<div class="flex gap-2"> ${post.data.tags.slice(0, 2).map((tag) => renderTemplate`<span class="capitalize bg-white/5 px-2 py-1 rounded-full">${tag}</span>`)} </div>`} </div> <h3 class="text-xl font-semibold text-gray-100 group-hover:text-amber-200 transition-colors duration-300 mb-2"> ${post.data.title} </h3> <p class="text-gray-400 line-clamp-3 text-sm flex-grow"> ${post.data.description} </p> <div class="mt-4 text-indigo-400 text-sm font-medium group-hover:text-indigo-300 flex items-center gap-1">
Read more
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4 transition-transform group-hover:translate-x-1"> <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.5a.75.75 0 010 1.08l-5.5 5.5a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"></path> </svg> </div> </div> </article> </a>`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/components/BlogCard.astro", void 0);

const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const posts = (await getCollection("blog", ({ data }) => {
    return data.draft !== true ;
  })).sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "The Flight Log | The Hermetic Flight Blog" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="relative z-10 pt-32 pb-20 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto"> <header class="text-center mb-16"> <h1 class="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">The Flight Log</h1> <p class="text-lg text-indigo-200/80 max-w-2xl mx-auto leading-relaxed">
Exploring the intersection of aerial arts, symbolism, and the journey of creation.
</p> </header> <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10"> ${posts.map((post) => renderTemplate`${renderComponent($$result2, "BlogCard", $$BlogCard, { "post": post })}`)} </section> ${posts.length === 0 && renderTemplate`<p class="text-center text-indigo-300 mt-10">No entries found yet. Check back soon.</p>`} </main> ` })}`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/index.astro", void 0);
const $$file = "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/index.astro";
const $$url = "/blog";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
