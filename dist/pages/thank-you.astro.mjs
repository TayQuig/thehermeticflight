/* empty css                                  */
import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead, h as renderScript } from '../chunks/astro/server_EKTnqeOm.mjs';
import 'piccolore';
import { $ as $$Layout } from '../chunks/Layout_D9ms0Y64.mjs';
export { renderers } from '../renderers.mjs';

const $$ThankYou = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Thank You | The Hermetic Flight", "description": "You are confirmed. Await the prophecy." }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<main class="w-full h-screen flex items-center justify-center relative z-10 animate-rise p-6"> <!-- Content Card --> <div class="glass-panel p-8 md:p-12 rounded-lg relative max-w-[600px] w-full border-hermetic-gold/30"> <!-- Decorative Corners --> <div class="absolute top-2 left-2 w-3 h-3 border-t border-l border-hermetic-gold opacity-50"></div> <div class="absolute top-2 right-2 w-3 h-3 border-t border-r border-hermetic-gold opacity-50"></div> <div class="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-hermetic-gold opacity-50"></div> <div class="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-hermetic-gold opacity-50"></div> <div class="text-center space-y-6"> <h2 class="font-serif text-2xl md:text-3xl text-hermetic-white uppercase tracking-widest border-b border-hermetic-gold/30 pb-4 inline-block">
The Path is Revealed
</h2> <p class="font-sans text-lg text-gray-300 font-light leading-relaxed">
Thank you for completing the quiz. As an initiate, you have secured an exclusive <span class="text-hermetic-sulfur font-normal">tarot reading with the first 5 cards</span>.
</p> <!-- Date Reveal (Calendar Utility) --> <div class="py-6 relative group"> <div class="absolute inset-0 bg-hermetic-emerald/50 rounded-lg blur opacity-50 group-hover:opacity-75 transition duration-500"></div> <div class="relative border border-hermetic-gold/50 rounded-lg p-6 bg-hermetic-void"> <p class="font-serif text-hermetic-gold text-sm tracking-widest uppercase mb-2">The Revelation Date</p> <p class="font-serif text-3xl text-white font-bold tracking-wider mb-4">JANUARY 11, 2026</p> <!-- Buttons --> <div class="flex flex-col sm:flex-row justify-center gap-3 mt-4"> <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=The+Hermetic+Flight+Tarot+Reveal&dates=20260111T170000Z/20260111T180000Z&details=Visit+www.thehermeticflight.com&location=www.thehermeticflight.com&sf=true&output=xml" target="_blank" class="text-xs font-sans tracking-widest uppercase border border-hermetic-sulfur text-hermetic-sulfur px-4 py-2 rounded hover:bg-hermetic-sulfur hover:text-black transition-colors">
Add to Google
</a> <button id="ics-btn" class="text-xs font-sans tracking-widest uppercase border border-hermetic-sulfur text-hermetic-sulfur px-4 py-2 rounded hover:bg-hermetic-sulfur hover:text-black transition-colors">
Download .ICS
</button> </div> </div> </div> <p class="font-sans text-gray-300 font-light">
You also have early access to the Kickstarter to secure one of the <span class="text-hermetic-sulfur">first 333 decks</span>.
</p> <!-- Beta Access Badge --> <div class="bg-hermetic-forest/30 border-l-2 border-hermetic-sulfur p-4 text-left mx-auto max-w-sm"> <p class="text-sm font-sans text-gray-300"> <span class="text-hermetic-sulfur font-bold uppercase text-xs block mb-1">Status Update</span>
Beta access privileges granted. Your feedback will help shape the final artifact.
</p> </div> </div> <!-- Footer Section --> <div class="mt-10 pt-6 border-t border-hermetic-gold/20 text-center space-y-6"> <p class="text-gray-400 text-sm font-sans">
Await further transmission from<br> <a href="mailto:contact@thehermeticflight.com" class="text-hermetic-gold hover:text-hermetic-sulfur transition-colors">contact@thehermeticflight.com</a> </p> <a href="/" class="btn-flame inline-block text-white font-sans font-bold text-sm tracking-widest uppercase px-10 py-4 no-underline">
Return Home
</a> </div> </div> </main>  ${renderScript($$result2, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro?astro&type=script&index=0&lang.ts")} ` })}`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro", void 0);

const $$file = "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro";
const $$url = "/thank-you";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$ThankYou,
	file: $$file,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
