/* empty css                                  */
import { c as createAstro, a as createComponent, m as maybeRenderHead, u as unescapeHTML, d as renderTemplate, r as renderComponent } from '../chunks/astro/server_EKTnqeOm.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_CeRGXfYN.mjs';
import 'clsx';
/* empty css                               */
import { g as getCollection } from '../chunks/_astro_content_B6aE7jDv.mjs';
export { renderers } from '../renderers.mjs';

const $$Astro = createAstro("https://www.thehermeticflight.com");
const $$AccordionItem = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$AccordionItem;
  const { question, answer } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<details class="group py-4 border-b border-white/10 cursor-pointer" data-astro-cid-3p7czjhg> <summary class="flex justify-between items-center font-medium list-none text-lg text-indigo-100 group-hover:text-amber-200 transition-colors duration-300" data-astro-cid-3p7czjhg> <span data-astro-cid-3p7czjhg>${question}</span> <span class="transition group-open:rotate-180" data-astro-cid-3p7czjhg> <!-- Simple chevron icon --> <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-indigo-300/70" data-astro-cid-3p7czjhg> <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" data-astro-cid-3p7czjhg></path> </svg> </span> </summary> <!-- We use set:html because the JSON answer contains <p> tags --> <div class="mt-4 text-base text-gray-300 leading-relaxed prose prose-invert max-w-none prose-p:my-2" data-astro-cid-3p7czjhg>${unescapeHTML(answer)}</div> </details> `;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/components/AccordionItem.astro", void 0);

const $$Faq = createComponent(async ($$result, $$props, $$slots) => {
  const faqCategories = await getCollection("faq");
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "FAQ | The Hermetic Flight" }, { "default": async ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="relative z-10 pt-32 pb-20 px-6 sm:px-8 lg:px-12 max-w-4xl mx-auto"> <header class="text-center mb-16"> <h1 class="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">Frequently Asked Questions</h1> <p class="text-lg text-indigo-200/80 max-w-2xl mx-auto leading-relaxed">
Everything you need to know about The Hermetic Flight Aerial Tarot Deck, our methodology, and the upcoming Kickstarter.
</p> </header> <div class="space-y-16"> <!-- Loop through each category file found in src/content/faq/ --> ${faqCategories.map((category) => renderTemplate`<section> <h2 class="text-2xl font-semibold text-amber-200/90 mb-6 pb-2 border-b border-white/10"> ${category.data.title} </h2> <div class="divide-y divide-white/5"> <!-- Loop through questions inside that category --> ${category.data.questions.map((qa) => renderTemplate`${renderComponent($$result2, "AccordionItem", $$AccordionItem, { "question": qa.q, "answer": qa.a })}`)} </div> </section>`)} </div> <!-- Final call to action block from your text --> <div class="mt-20 p-8 bg-indigo-950/30 border border-white/10 rounded-lg text-center"> <h3 class="text-2xl text-white font-semibold mb-4">Still Have Questions?</h3> <p class="text-indigo-200 mb-6">
Connect with us on social media at <a href="https://instagram.com/thehermeticflight" class="text-amber-200 hover:underline">@thehermeticflight</a> or join our newsletter for direct updates.
</p> <p class="italic text-indigo-300/70 font-serif">
"Between earth and sky, between question and answer, we find our truth in suspension."
</p> </div> </main> ` })}`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/faq.astro", void 0);

const $$file = "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/faq.astro";
const $$url = "/faq";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Faq,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
