/* NPCTE service worker: offline fallback + notification clicks (+ Web Push in the real app) */
const C='npcte-v6';
/* install never fails: one file that cannot be cached (a redirect such as /offline.html -> /offline with cleanUrls,
   a login wall on a protected preview, a 404) used to reject addAll, the worker never activated and NO notification could be shown */
const PRE=['/','/offline.html','/icons/icon-192.png','/icons/icon-512.png','/icons/badge-96.png','/manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>Promise.all(PRE.map(u=>fetch(u,{credentials:'same-origin'}).then(r=>{if(r.ok&&!r.redirected)return c.put(u,r)}).catch(()=>{})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin||r.url.includes('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put('/',cp));return res}).catch(()=>caches.match('/').then(x=>x||caches.match('/offline.html')).then(x=>x||new Response('Offline',{status:503}))));return}
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
/* Web Push from the server (Phase 6 of the real build): payload {title, body, link} */
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'NPCTE',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'NPCTE',{body:d.body||'',tag:d.tag||undefined,renotify:!!d.tag,silent:false,vibrate:[200,100,200],icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',timestamp:Date.now(),data:{link:d.link||'/'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const link=(e.notification.data&&e.notification.data.link)||'/';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{const w=l.find(c=>'focus' in c);return w?w.focus():self.clients.openWindow(link)}))});
/* the page asks the service worker to show a notification after a delay: it still appears when the app is
   closed or the phone is locked (the worker is kept alive with waitUntil for up to ~25 s) */
self.addEventListener('message',e=>{const d=e.data||{};if(d.type!=='notify')return;const wait=Math.min(25000,Math.max(0,+d.delay||0));
  e.waitUntil(new Promise(r=>setTimeout(r,wait)).then(()=>self.registration.showNotification(d.title||'NPCTE',{body:d.body||'',tag:d.tag||('n'+Date.now()),renotify:true,silent:false,vibrate:[200,100,200],requireInteraction:false,icon:'/icons/icon-192.png',badge:'/icons/badge-96.png',timestamp:Date.now(),data:{link:d.link||'/'}})))});
