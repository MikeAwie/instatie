self.dbName = 'instatie-db';
self.dbVersion = 1;

self.openDB = () =>
  new Promise((resolve, reject) => {
    const openDbReq = indexedDB.open(self.dbName, self.dbVersion);
    openDbReq.onupgradeneeded = ({ oldVersion }) => {
      const db = openDbReq.result;
      switch (oldVersion) {
        case 0:
          db.createObjectStore('news', { keyPath: 'title' });
          db.createObjectStore('stations', { keyPath: 'externalId' });
          db.createObjectStore('fetch-queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
      }
    };
    openDbReq.onsuccess = () => resolve(openDbReq.result);
    openDbReq.onerror = reject;
  });

self.putIntoDB = (objectStore, objs) =>
  Promise.all(
    (Array.isArray(objs) ? objs : [objs]).map((obj) =>
      self.openDB().then(
        (db) =>
          new Promise((resolve, reject) => {
            const req = db.transaction(objectStore, 'readwrite').objectStore(objectStore).put(obj);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
          }),
      ),
    ),
  );

self.removeFromDB = (objectStore, ids) =>
  Promise.all(
    (Array.isArray(ids) ? ids : [ids]).map((id) =>
      self.openDB().then(
        (db) =>
          new Promise((resolve, reject) => {
            const req = db.transaction(objectStore, 'readwrite').objectStore(objectStore).delete(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = reject;
          }),
      ),
    ),
  );

self.getAllFromDB = (objectStore) =>
  self.openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(objectStore).objectStore(objectStore).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = reject;
      }),
  );
