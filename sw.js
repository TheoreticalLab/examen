// Service worker mínimo: solo sirve para mostrar el aviso «Has salido del examen» y, al tocarlo, volver al examen.
// No guarda nada en caché.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => /\/index\.html$|\/$/.test(new URL(x.url).pathname)) || cs[0];
    return c ? c.focus() : self.clients.openWindow('./');
  }));
});
