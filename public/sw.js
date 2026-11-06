const CACHE='vault-public-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/manifest.webmanifest','/icon.svg'])));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vault-public-')&&k!==CACHE).map(k=>caches.delete(k)))));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  // Auth, device and note responses are always network-only, never cached.
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||event.request.method!=='GET')return;
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
