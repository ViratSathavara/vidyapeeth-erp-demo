/* NPCTE service worker: offline fallback + notification clicks (+ Web Push in the real app) */
const C='npcte-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/offline.html','/icons/icon-192.png','/manifest.webmanifest'])).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET'||new URL(r.url).origin!==location.origin||r.url.includes('/api/'))return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put('/',cp));return res}).catch(()=>caches.match('/').then(x=>x||caches.match('/offline.html'))));return}
  e.respondWith(caches.match(r).then(x=>x||fetch(r)));
});
/* Web Push from the server (Phase 6 of the real build): payload {title, body, link} */
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'NPCTE',body:e.data&&e.data.text()}}
  e.waitUntil(self.registration.showNotification(d.title||'NPCTE',{body:d.body||'',icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{link:d.link||'/'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const link=(e.notification.data&&e.notification.data.link)||'/';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{const w=l.find(c=>'focus' in c);return w?w.focus():self.clients.openWindow(link)}))});
