const DB_NAME = 'cc-mascot-db';
const STORE_NAME = 'vrm-models';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function saveVRMFile(file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, 'current-vrm');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadVRMFile(): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('current-vrm');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || null);
  });
}

export async function deleteVRMFile(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete('current-vrm');

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export function createBlobURL(file: File): string {
  return URL.createObjectURL(file);
}

export function revokeBlobURL(url: string): void {
  URL.revokeObjectURL(url);
}
