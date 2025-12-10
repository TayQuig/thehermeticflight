/* empty css                                     */
import { c as createAstro, a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead, b as addAttribute } from '../../chunks/astro/server_EKTnqeOm.mjs';
import 'piccolore';
import { g as getCollection } from '../../chunks/_astro_content_B6aE7jDv.mjs';
import { $ as $$Layout } from '../../chunks/Layout_CeRGXfYN.mjs';
import { $ as $$Image } from '../../chunks/_astro_assets_w1CU3Cd8.mjs';
export { renderers } from '../../renderers.mjs';

const $$Astro = createAstro("https://www.thehermeticflight.com");
async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: post
  }));
}
const $$ = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$;
  const post = Astro2.props;
  const { Content } = await post.render();
  const formattedDate = post.data.pubDate.toLocaleDateString("en-us", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": `${post.data.title} | The Hermetic Flight Blog` }, { "default": async ($$result2) => renderTemplate`  ${maybeRenderHead()}<div class="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-black/80 to-transparent z-0 pointer-events-none"></div> <main class="relative z-10 pt-32 pb-20 px-6 sm:px-8"> <article class="max-w-3xl mx-auto"> <!-- Header Area --> <header class="mb-12 text-center"> <div class="flex items-center justify-center gap-x-4 text-sm text-indigo-300 mb-4"> <time${addAttribute(post.data.pubDate.toISOString(), "datetime")}>${formattedDate}</time> <span>•</span> <span>${post.data.author}</span> </div> <h1 class="text-3xl md:text-5xl font-bold text-white mb-8 leading-tight">${post.data.title}</h1> <!-- Hero Image --> ${post.data.heroImage && renderTemplate`<div class="rounded-xl overflow-hidden shadow-2xl shadow-indigo-900/20 mb-10 aspect-video relative"> ${renderComponent($$result2, "Image", $$Image, { "src": post.data.heroImage, "alt": post.data.heroImageAlt || "", "class": "object-cover w-full h-full", "width": 1024, "height": 576, "loading": "eager" })} </div>`} </header> <!-- 
               The MDX Content Rendered Here. 
               We use 'prose-invert' for dark mode markdown styling.
               We override some specifics to match the site vibe.
            --> <div class="prose prose-lg prose-invert max-w-none 
                prose-headings:text-amber-100 
                prose-a:text-amber-200 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-white prose-strong:font-semibold
                prose-img:rounded-xl prose-img:shadow-lg
            "> ${renderComponent($$result2, "Content", Content, {})} </div> <!-- Tags/Footer area of the post --> ${post.data.tags && renderTemplate`<footer class="mt-12 pt-6 border-t border-white/10"> <div class="flex gap-3 flex-wrap"> ${post.data.tags.map((tag) => renderTemplate`<span class="text-sm text-indigo-300 bg-indigo-950/50 px-3 py-1 rounded-full">#${tag}</span>`)} </div> <div class="mt-8"> <a href="/blog" class="text-indigo-300 hover:text-amber-200 transition flex items-center gap-2">
← Back to Flight Log
</a> </div> </footer>`} </article> </main> ` })}`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/[...slug].astro", void 0);

const $$file = "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/[...slug].astro";
const $$url = "/blog/[...slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$,
  file: $$file,
  getStaticPaths,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
