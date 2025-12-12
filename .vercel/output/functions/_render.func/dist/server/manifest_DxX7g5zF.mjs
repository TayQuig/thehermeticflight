import 'piccolore';
import { k as decodeKey } from './chunks/astro/server_BFIVxu1L.mjs';
import 'clsx';
import { N as NOOP_MIDDLEWARE_FN } from './chunks/astro-designed-error-pages_Cl0RWFY0.mjs';
import 'es-module-lexer';

function sanitizeParams(params) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (typeof value === "string") {
        return [key, value.normalize().replace(/#/g, "%23").replace(/\?/g, "%3F")];
      }
      return [key, value];
    })
  );
}
function getParameter(part, params) {
  if (part.spread) {
    return params[part.content.slice(3)] || "";
  }
  if (part.dynamic) {
    if (!params[part.content]) {
      throw new TypeError(`Missing parameter: ${part.content}`);
    }
    return params[part.content];
  }
  return part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]");
}
function getSegment(segment, params) {
  const segmentPath = segment.map((part) => getParameter(part, params)).join("");
  return segmentPath ? "/" + segmentPath : "";
}
function getRouteGenerator(segments, addTrailingSlash) {
  return (params) => {
    const sanitizedParams = sanitizeParams(params);
    let trailing = "";
    if (addTrailingSlash === "always" && segments.length) {
      trailing = "/";
    }
    const path = segments.map((segment) => getSegment(segment, sanitizedParams)).join("") + trailing;
    return path || "/";
  };
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments,
    prerender: rawRouteData.prerender,
    redirect: rawRouteData.redirect,
    redirectRoute: rawRouteData.redirectRoute ? deserializeRouteData(rawRouteData.redirectRoute) : void 0,
    fallbackRoutes: rawRouteData.fallbackRoutes.map((fallback) => {
      return deserializeRouteData(fallback);
    }),
    isIndex: rawRouteData.isIndex,
    origin: rawRouteData.origin
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  const componentMetadata = new Map(serializedManifest.componentMetadata);
  const inlinedScripts = new Map(serializedManifest.inlinedScripts);
  const clientDirectives = new Map(serializedManifest.clientDirectives);
  const serverIslandNameMap = new Map(serializedManifest.serverIslandNameMap);
  const key = decodeKey(serializedManifest.key);
  return {
    // in case user middleware exists, this no-op middleware will be reassigned (see plugin-ssr.ts)
    middleware() {
      return { onRequest: NOOP_MIDDLEWARE_FN };
    },
    ...serializedManifest,
    assets,
    componentMetadata,
    inlinedScripts,
    clientDirectives,
    routes,
    serverIslandNameMap,
    key
  };
}

const manifest = deserializeManifest({"hrefRoot":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/","cacheDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/node_modules/.astro/","outDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/dist/","srcDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/src/","publicDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/public/","buildClientDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/dist/client/","buildServerDir":"file:///Users/taylorquigley/Documents/Directories/thehermeticflight/dist/server/","adapterName":"@astrojs/vercel","routes":[{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"page","component":"_server-islands.astro","params":["name"],"segments":[[{"content":"_server-islands","dynamic":false,"spread":false}],[{"content":"name","dynamic":true,"spread":false}]],"pattern":"^\\/_server-islands\\/([^/]+?)\\/?$","prerender":false,"isIndex":false,"fallbackRoutes":[],"route":"/_server-islands/[name]","origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"blog/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/blog","isIndex":false,"type":"page","pattern":"^\\/blog\\/?$","segments":[[{"content":"blog","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/blog.astro","pathname":"/blog","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"faq/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/faq","isIndex":false,"type":"page","pattern":"^\\/faq\\/?$","segments":[[{"content":"faq","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/faq.astro","pathname":"/faq","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"thank-you/index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/thank-you","isIndex":false,"type":"page","pattern":"^\\/thank-you\\/?$","segments":[[{"content":"thank-you","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/thank-you.astro","pathname":"/thank-you","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"index.html","links":[],"scripts":[],"styles":[],"routeData":{"route":"/","isIndex":true,"type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","prerender":true,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"type":"endpoint","isIndex":false,"route":"/_image","pattern":"^\\/_image\\/?$","segments":[[{"content":"_image","dynamic":false,"spread":false}]],"params":[],"component":"node_modules/astro/dist/assets/endpoint/generic.js","pathname":"/_image","prerender":false,"fallbackRoutes":[],"origin":"internal","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":[],"scripts":[],"styles":[],"routeData":{"route":"/api/webhooks/seobot","isIndex":false,"type":"endpoint","pattern":"^\\/api\\/webhooks\\/seobot\\/?$","segments":[[{"content":"api","dynamic":false,"spread":false}],[{"content":"webhooks","dynamic":false,"spread":false}],[{"content":"seobot","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/api/webhooks/seobot.ts","pathname":"/api/webhooks/seobot","prerender":false,"fallbackRoutes":[],"distURL":[],"origin":"project","_meta":{"trailingSlash":"ignore"}}}],"site":"https://www.thehermeticflight.com","base":"/","trailingSlash":"ignore","compressHTML":true,"componentMetadata":[["\u0000astro:content",{"propagation":"in-tree","containsHead":false}],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/blog@_@astro",{"propagation":"in-tree","containsHead":false}],["\u0000@astrojs-ssr-virtual-entry",{"propagation":"in-tree","containsHead":false}],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/[...slug].astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/blog/[...slug]@_@astro",{"propagation":"in-tree","containsHead":false}],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/faq.astro",{"propagation":"in-tree","containsHead":true}],["\u0000@astro-page:src/pages/faq@_@astro",{"propagation":"in-tree","containsHead":false}],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/index.astro",{"propagation":"none","containsHead":true}],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro",{"propagation":"none","containsHead":true}]],"renderers":[],"clientDirectives":[["idle","(()=>{var l=(n,t)=>{let i=async()=>{await(await n())()},e=typeof t.value==\"object\"?t.value:void 0,s={timeout:e==null?void 0:e.timeout};\"requestIdleCallback\"in window?window.requestIdleCallback(i,s):setTimeout(i,s.timeout||200)};(self.Astro||(self.Astro={})).idle=l;window.dispatchEvent(new Event(\"astro:idle\"));})();"],["load","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).load=e;window.dispatchEvent(new Event(\"astro:load\"));})();"],["media","(()=>{var n=(a,t)=>{let i=async()=>{await(await a())()};if(t.value){let e=matchMedia(t.value);e.matches?i():e.addEventListener(\"change\",i,{once:!0})}};(self.Astro||(self.Astro={})).media=n;window.dispatchEvent(new Event(\"astro:media\"));})();"],["only","(()=>{var e=async t=>{await(await t())()};(self.Astro||(self.Astro={})).only=e;window.dispatchEvent(new Event(\"astro:only\"));})();"],["visible","(()=>{var a=(s,i,o)=>{let r=async()=>{await(await s())()},t=typeof i.value==\"object\"?i.value:void 0,c={rootMargin:t==null?void 0:t.rootMargin},n=new IntersectionObserver(e=>{for(let l of e)if(l.isIntersecting){n.disconnect(),r();break}},c);for(let e of o.children)n.observe(e)};(self.Astro||(self.Astro={})).visible=a;window.dispatchEvent(new Event(\"astro:visible\"));})();"]],"entryModules":{"\u0000noop-middleware":"_noop-middleware.mjs","\u0000virtual:astro:actions/noop-entrypoint":"noop-entrypoint.mjs","\u0000@astro-page:node_modules/astro/dist/assets/endpoint/generic@_@js":"pages/_image.astro.mjs","\u0000@astro-page:src/pages/api/webhooks/seobot@_@ts":"pages/api/webhooks/seobot.astro.mjs","\u0000@astro-page:src/pages/blog@_@astro":"pages/blog.astro.mjs","\u0000@astro-page:src/pages/blog/[...slug]@_@astro":"pages/blog/_---slug_.astro.mjs","\u0000@astro-page:src/pages/faq@_@astro":"pages/faq.astro.mjs","\u0000@astro-page:src/pages/thank-you@_@astro":"pages/thank-you.astro.mjs","\u0000@astro-page:src/pages/index@_@astro":"pages/index.astro.mjs","\u0000@astrojs-ssr-virtual-entry":"entry.mjs","\u0000@astro-renderers":"renderers.mjs","\u0000@astrojs-ssr-adapter":"_@astrojs-ssr-adapter.mjs","\u0000@astrojs-manifest":"manifest_DxX7g5zF.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/node_modules/astro/dist/assets/services/sharp.js":"chunks/sharp_BBw7UkXR.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/.astro/content-assets.mjs":"chunks/content-assets_DleWbedO.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/.astro/content-modules.mjs":"chunks/content-modules_CvkRtXcy.mjs","\u0000astro:data-layer-content":"chunks/_astro_data-layer-content_CRAhaQIl.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/content/blog/welcome-to-the-flight.mdx?astroPropagatedAssets":"chunks/welcome-to-the-flight_hH71zscv.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/content/blog/welcome-to-the-flight.mdx":"chunks/welcome-to-the-flight_D_CYKCY8.mjs","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/[...slug].astro?astro&type=script&index=0&lang.ts":"_astro/_...slug_.astro_astro_type_script_index_0_lang.C-E1sTr5.js","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/faq.astro?astro&type=script&index=0&lang.ts":"_astro/faq.astro_astro_type_script_index_0_lang.C-E1sTr5.js","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro?astro&type=script&index=0&lang.ts":"_astro/thank-you.astro_astro_type_script_index_0_lang.-rSuE3Dw.js","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/index.astro?astro&type=script&index=0&lang.ts":"_astro/index.astro_astro_type_script_index_0_lang.C-E1sTr5.js","/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog.astro?astro&type=script&index=0&lang.ts":"_astro/blog.astro_astro_type_script_index_0_lang.C-E1sTr5.js","astro:scripts/before-hydration.js":""},"inlinedScripts":[["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog/[...slug].astro?astro&type=script&index=0&lang.ts","const s=new IntersectionObserver(e=>{e.forEach(r=>{r.isIntersecting&&r.target.classList.add(\"reveal-visible\")})},{threshold:.1});document.querySelectorAll(\".reveal-up\").forEach(e=>s.observe(e));"],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/faq.astro?astro&type=script&index=0&lang.ts","const s=new IntersectionObserver(e=>{e.forEach(r=>{r.isIntersecting&&r.target.classList.add(\"reveal-visible\")})},{threshold:.1});document.querySelectorAll(\".reveal-up\").forEach(e=>s.observe(e));"],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/thank-you.astro?astro&type=script&index=0&lang.ts","document.getElementById(\"ics-btn\")?.addEventListener(\"click\",()=>{const e=`BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//The Hermetic Flight//NONSGML v1.0//EN\nBEGIN:VEVENT\nUID:${Date.now()}@thehermeticflight.com\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,\"\").split(\".\")[0]}Z\nDTSTART:20260111T120000Z\nDTEND:20260111T130000Z\nSUMMARY:The Hermetic Flight: Tarot Reveal\nDESCRIPTION:The reveal of the first 5 cards and early access to the Kickstarter (First 333 decks).\nLOCATION:www.thehermeticflight.com\nEND:VEVENT\nEND:VCALENDAR`,c=new Blob([e],{type:\"text/calendar;charset=utf-8\"}),t=document.createElement(\"a\");t.href=window.URL.createObjectURL(c),t.setAttribute(\"download\",\"hermetic-flight-reveal.ics\"),document.body.appendChild(t),t.click(),document.body.removeChild(t)});"],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/index.astro?astro&type=script&index=0&lang.ts","const s=new IntersectionObserver(e=>{e.forEach(r=>{r.isIntersecting&&r.target.classList.add(\"reveal-visible\")})},{threshold:.1});document.querySelectorAll(\".reveal-up\").forEach(e=>s.observe(e));"],["/Users/taylorquigley/Documents/Directories/thehermeticflight/src/pages/blog.astro?astro&type=script&index=0&lang.ts","const s=new IntersectionObserver(e=>{e.forEach(r=>{r.isIntersecting&&r.target.classList.add(\"reveal-visible\")})},{threshold:.1});document.querySelectorAll(\".reveal-up\").forEach(e=>s.observe(e));"]],"assets":["/_astro/blog.BAofLmvr.css","/robots.txt","/blog/index.html","/faq/index.html","/thank-you/index.html","/index.html"],"buildFormat":"directory","checkOrigin":true,"allowedDomains":[],"serverIslandNameMap":[],"key":"dnRoTyzz/Gi9XOUsvlYqkHAr4Z/6XimoexNUMhNlpHU="});
if (manifest.sessionConfig) manifest.sessionConfig.driverModule = null;

export { manifest };
