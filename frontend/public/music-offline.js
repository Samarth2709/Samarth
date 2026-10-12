/* Public study assets only; no grading answers, credentials or private PDFs. */
const CACHE='music-study-exam-v2';
const APP='/music';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.add(new Request(APP,{cache:'reload'}))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('music-study-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{
 if(!event.source||!event.source.url||new URL(event.source.url).origin!==self.location.origin||new URL(event.source.url).pathname!==APP)return;
 if(event.data?.type!=='CACHE_PUBLIC_ASSETS'||!Array.isArray(event.data.urls))return;
 const urls=event.data.urls.filter(v=>{try{const u=new URL(v,self.location.origin);return u.origin===self.location.origin&&u.pathname.startsWith('/_next/static/');}catch{return false;}}).slice(0,40);
 event.waitUntil(caches.open(CACHE).then(c=>Promise.allSettled(urls.map(u=>c.add(u)))));
});
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);
 if(event.request.method!=='GET'||u.origin!==self.location.origin)return;
 if(u.pathname===APP&&event.request.mode==='navigate'){
  event.respondWith(fetch(event.request).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(APP,clone));}return res;}).catch(()=>caches.match(APP).then(res=>res||Response.error())));return;
 }
 if(u.pathname.startsWith('/_next/static/'))event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{if(res.ok){const clone=res.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));}return res;})));
});
