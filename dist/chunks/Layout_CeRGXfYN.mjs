import { c as createAstro, a as createComponent, d as renderTemplate, r as renderComponent, i as renderSlot, m as maybeRenderHead, b as addAttribute } from './astro/server_EKTnqeOm.mjs';
import 'piccolore';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://www.thehermeticflight.com");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  return renderTemplate(_a || (_a = __template([`// src/layouts/Layout.astro
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet"><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
		new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
		j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
		'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
		})(window,document,'script','dataLayer','GTM-XXXXXXX');<\/script>
import '../styles/global.css';
// CHANGE: Imports are now lowercase to match the new filenames created by git mv
import Header from '../components/header.astro';
import Footer from '../components/footer.astro';

interface Props {
	title?: string;
}

const { title } = Astro.props;
<meta charset="UTF-8"> <meta name="description" content="The Hermetic Flight: An Aerial Tarot Deck combining traditional tarot symbolism with professional aerial arts photography."> <meta name="viewport" content="width=device-width"> <link rel="icon" type="image/svg+xml" href="/favicon.svg"> <link rel="sitemap" href="/sitemap-index.xml"> <meta name="generator"`, "> <title>", "\n		\n		<!-- Fonts -->\n		\n		\n		\n\n		<!-- Google Tag Manager -->\n		\n		<!-- End Google Tag Manager -->\n	\n	\n		<!-- Google Tag Manager (noscript) -->\n		", `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-XXXXXXX" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
		<!-- End Google Tag Manager (noscript) -->
		
		<div class="fixed inset-0 z-0 pointer-events-none">
			<div class="absolute inset-0 bg-[url('/images/stars-bg.png')] bg-repeat opacity-60 animate-twinkle"></div>
			<div class="absolute inset-0 bg-gradient-radial from-indigo-950/30 via-[#0a0a12]/80 to-[#0a0a12]"></div>
			<div class="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#0a0a12] via-[#0a0a12]/50 to-transparent"></div>
			<div class="absolute inset-0 bg-[url('/images/fog-overlay.png')] bg-cover bg-center opacity-30 animate-drift mix-blend-screen"></div>
		</div>

		`, '\n\n		<main class="flex-grow relative z-10">\n			', "\n		</main>\n\n		", "\n	\n</title>"])), addAttribute(Astro2.generator, "content"), Astro2.props.title ? `${Astro2.props.title} | The Hermetic Flight` : "The Hermetic Flight", maybeRenderHead(), renderComponent($$result, "Header", Header, {}), renderSlot($$result, $$slots["default"]), renderComponent($$result, "Footer", Footer, {}));
}, "/Users/taylorquigley/Documents/Directories/thehermeticflight/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
