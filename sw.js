// Entschlüsselt die Website im Browser. Alles unter /app/ wird aus /enc/*.enc
// geladen und mit dem Schlüssel aus dem Passwort (IndexedDB) entschlüsselt.
const DB = "fotokeiser";
const STORE = "keys";
const TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  woff2: "font/woff2",
};
let key = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getKey() {
  if (key) return key;
  const db = await openDb();
  key = await new Promise((resolve) => {
    const req = db.transaction(STORE).objectStore(STORE).get("key");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
  return key;
}

self.addEventListener("message", (e) => {
  if (e.data === "reset") key = null;
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const base = new URL("./", self.registration.scope).pathname;
  if (url.origin !== location.origin || !url.pathname.startsWith(base + "app/")) return;

  e.respondWith(
    (async () => {
      const k = await getKey();
      if (!k) return Response.redirect(base, 302);
      let path = decodeURIComponent(url.pathname.slice((base + "app/").length));
      if (path === "" || path.endsWith("/")) path += "index.html";
      const res = await fetch(base + "enc/" + path + ".enc");
      if (!res.ok) return new Response("Nicht gefunden", { status: 404 });
      const buf = await res.arrayBuffer();
      try {
        const plain = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(buf, 0, 12) },
          k,
          new Uint8Array(buf, 12)
        );
        const ext = path.split(".").pop().toLowerCase();
        return new Response(plain, { headers: { "Content-Type": TYPES[ext] || "application/octet-stream" } });
      } catch (err) {
        // gespeichertes Passwort passt nicht mehr (z. B. geändert): neu abfragen
        key = null;
        return Response.redirect(base + "?neu", 302);
      }
    })()
  );
});
