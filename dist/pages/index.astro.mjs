/* empty css                                  */
import { a as createComponent, r as renderComponent, d as renderTemplate, m as maybeRenderHead } from '../chunks/astro/server_EKTnqeOm.mjs';
import 'piccolore';
export { renderers } from '../renderers.mjs';

const $$Index = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`// src/pages/index.astro

import Layout from '../layouts/Layout.astro';
import { Image } from 'astro:assets';
// Assuming your logo file is here based on previous context, update path if incorrect
import logoImage from '/public/images/logo-full-white.png';
${renderComponent($$result, "Layout", Layout, { "title": "Home" }, { "default": ($$result2) => renderTemplate`  ${maybeRenderHead()}<main class="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 sm:px-8 lg:px-12 text-center pt-28 pb-20"> <!-- Main Logo/Hero Section --> <div class="mb-12 relative group"> <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500/30 to-amber-500/30 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 animate-pulse-slow"></div> ${renderComponent($$result2, "Image", Image, { "src": logoImage, "alt": "The Hermetic Flight Aerial Tarot Deck Logo", "width": 600, "height": 400, "class": "relative w-full max-w-md md:max-w-xl h-auto drop-shadow-[0_0_25px_rgba(99,102,241,0.3)]", "loading": "eager" })} </div> <!-- Hero Text --> <h1 class="font-cinzel text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 tracking-wide drop-shadow-lg leading-tight"> <span class="block bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-100 to-amber-100">
As Above, So Below.
</span> <span class="block text-2xl sm:text-3xl md:text-4xl mt-4 text-indigo-200/90 font-normal tracking-wider">
The Tarot in Suspension.
</span> </h1> <!-- Subtext --> <p class="max-w-2xl text-lg sm:text-xl text-indigo-200/80 mb-12 leading-relaxed drop-shadow">
A revolutionary 78-card tarot deck featuring professional aerial artists, capturing the living embodiment of archetypal energy between earth and sky.
</p> <!-- CTA Button --> <div> <a href="/blog/welcome-to-the-flight" class="group relative inline-flex items-center justify-center px-12 py-4 overflow-hidden font-cinzel font-bold tracking-widest text-white bg-indigo-950 rounded-lg transition-all duration-300 ease-out hover:scale-105 hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0a0a12]"> <span class="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-600 via-indigo-800 to-amber-700 opacity-80 group-hover:opacity-100 transition-opacity duration-300 ease-out"></span> <span class="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-amber-500 opacity-30 group-hover:rotate-90 ease"></span> <span class="relative flex items-center gap-3">
Explore The Deck
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 group-hover:translate-x-1 transition-transform"> <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"></path> </svg> </span> </a> <p class="mt-6 text-sm text-indigo-300/60 tracking-wider uppercase">
Launching on Kickstarter<br>January 11, 2026
</p> </div> </main> ` })}`;
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/index.astro", void 0);

const $$file = "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: $$Index,
	file: $$file,
	url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
