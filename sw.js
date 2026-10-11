/* Parts Finder app: keeps the app itself on the device so it opens without internet.
   Your data is not handled here; the page keeps it in its own storage and syncs it with your database. */
const VERSION = "982a6bacb116";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
const SHELL_CACHE = "pf-shell-" + VERSION;
// the libraries (PDF, barcodes, text reading) stay across app updates; a new name here fetches them again
const LIB = ["lib/pdf-lib.min.js", "lib/zxing.js"];
const LIB_CACHE = "pf-lib-1";
const EXTRA_CACHE = "pf-extra";   // fonts and the Excel library, kept once used

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })));
    const lib = await caches.open(LIB_CACHE);
    for (const u of LIB) { if (!(await lib.match(u))) { try { await lib.add(u); } catch (_) {} } }
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith("pf-shell-") && k !== SHELL_CACHE) || (k.startsWith("pf-lib-") && k !== LIB_CACHE)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)); }
self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (req.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
      // the newest version when there is internet, otherwise the one kept here
      ev.respondWith(Promise.race([fetch(req, { cache: "no-cache" }), timeout(5000)])
        .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(SHELL_CACHE).then((c) => c.put("index.html", copy)); } return r; })
        .catch(() => caches.match("index.html", { cacheName: SHELL_CACHE }).then((r) => r || caches.match("index.html"))));
      return;
    }
    if (url.pathname.includes("/lib/")) {
      ev.respondWith(caches.open(LIB_CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }))));
      return;
    }
    ev.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  if (/^(fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(url.hostname)) {
    ev.respondWith(caches.open(EXTRA_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }))));
  }
});
