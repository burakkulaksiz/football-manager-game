/*
 * Service worker: oyun bir kez açıldıktan sonra internetsiz de çalışsın.
 * Sayfa (index.html): önce ağ (yeni sürüm gelsin), ağ yoksa önbellek. Diğer dosyalar (JS/CSS adları içerikten türetilir,
 * fontlar, sesler): önce önbellek, yoksa ağdan alınıp saklanır. Yalnızca aynı kaynaktan GET istekleri.
 * shortcut: sesler ilk çalındıklarında saklanır (hiç duyulmamış ses internetsizken çalmaz); gerekirse kurulumda önceden yükle.
 */
const CACHE = 'futbol-menajeri-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  // Eski sürümün önbelleği silinir; açık sekmeler hemen bu worker'a geçer
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function store(request, response) {
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => store(request, response))
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match(self.registration.scope))),
    );
    return;
  }
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request).then((response) => store(request, response))));
});
