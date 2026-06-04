import {
  AccountingCategory,
  AccountingEntry,
  AccountingDocument,
  Invoice,
  PersistentStateSnapshot,
  Supplier,
  Transaction,
} from '../types';

const DATABASE_NAME = 'gazelle-comptabilite-vault';
const DATABASE_VERSION = 1;
const KEY_STORAGE_NAME = 'gazelle-comptabilite:vault-key';

export const PERSISTENT_STORES = [
  'invoices',
  'transactions',
  'suppliers',
  'categories',
  'documents',
  'accounting_entries',
] as const;

type PersistentStoreName = (typeof PERSISTENT_STORES)[number];

type StoreRecordMap = {
  invoices: Invoice;
  transactions: Transaction;
  suppliers: Supplier;
  categories: AccountingCategory;
  documents: AccountingDocument;
  accounting_entries: AccountingEntry;
};

type EncryptedPayload = {
  id: string;
  iv: number[];
  data: string;
  updatedAt: string;
};

export type PersistenceStatus = 'idle' | 'loading' | 'syncing' | 'synced' | 'error';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  request.onupgradeneeded = () => {
    const database = request.result;

    PERSISTENT_STORES.forEach((storeName) => {
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    });
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Impossible d’ouvrir la base locale chiffrée.'));
});

const runTransaction = <T>(
  database: IDBDatabase,
  storeNames: PersistentStoreName | PersistentStoreName[],
  mode: IDBTransactionMode,
  operation: (transaction: IDBTransaction) => Promise<T>,
): Promise<T> => {
  const transaction = database.transaction(storeNames, mode);

  return new Promise((resolve, reject) => {
    let result: T;
    let operationCompleted = false;

    transaction.oncomplete = () => {
      if (operationCompleted) {
        resolve(result);
      }
    };

    transaction.onerror = () => reject(transaction.error ?? new Error('Erreur de transaction IndexedDB.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction IndexedDB annulée.'));

    operation(transaction)
      .then((operationResult) => {
        result = operationResult;
        operationCompleted = true;
      })
      .catch((error: unknown) => {
        transaction.abort();
        reject(error);
      });
  });
};

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('Erreur IndexedDB.'));
});

const bytesToBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value: string): Uint8Array => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const getCryptoKey = async (): Promise<CryptoKey> => {
  const storedKey = window.localStorage.getItem(KEY_STORAGE_NAME);

  if (storedKey) {
    return window.crypto.subtle.importKey(
      'raw',
      base64ToBytes(storedKey),
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  window.localStorage.setItem(KEY_STORAGE_NAME, bytesToBase64(rawKey));

  return window.crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

const encryptRecord = async <T extends { id: string }>(record: T): Promise<EncryptedPayload> => {
  const key = await getCryptoKey();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    textEncoder.encode(JSON.stringify(record)),
  );

  return {
    id: record.id,
    iv: Array.from(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
    updatedAt: new Date().toISOString(),
  };
};

const decryptRecord = async <T>(payload: EncryptedPayload): Promise<T> => {
  const key = await getCryptoKey();
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(payload.iv) },
    key,
    base64ToBytes(payload.data),
  );

  return JSON.parse(textDecoder.decode(decrypted)) as T;
};

export const loadStore = async <TStoreName extends PersistentStoreName>(
  storeName: TStoreName,
): Promise<StoreRecordMap[TStoreName][]> => {
  const database = await openDatabase();

  const payloads = await runTransaction(database, storeName, 'readonly', async (transaction) => {
    const store = transaction.objectStore(storeName);
    return requestToPromise<EncryptedPayload[]>(store.getAll());
  });

  database.close();

  return Promise.all(payloads.map((payload) => decryptRecord<StoreRecordMap[TStoreName]>(payload)));
};

export const loadSnapshot = async (): Promise<PersistentStateSnapshot> => {
  const [invoices, transactions, suppliers, categories, documents, accountingEntries] = await Promise.all([
    loadStore('invoices'),
    loadStore('transactions'),
    loadStore('suppliers'),
    loadStore('categories'),
    loadStore('documents'),
    loadStore('accounting_entries'),
  ]);

  return { invoices, transactions, suppliers, categories, documents, accountingEntries };
};

export const upsertRecords = async <TStoreName extends PersistentStoreName>(
  storeName: TStoreName,
  records: StoreRecordMap[TStoreName][],
): Promise<void> => {
  if (records.length === 0) return;

  const database = await openDatabase();
  const encryptedRecords = await Promise.all(records.map((record) => encryptRecord(record)));

  await runTransaction(database, storeName, 'readwrite', async (transaction) => {
    const store = transaction.objectStore(storeName);
    await Promise.all(encryptedRecords.map((record) => requestToPromise(store.put(record))));
  });

  database.close();
};

export const deleteRecord = async (storeName: PersistentStoreName, id: string): Promise<void> => {
  const database = await openDatabase();

  await runTransaction(database, storeName, 'readwrite', async (transaction) => {
    await requestToPromise(transaction.objectStore(storeName).delete(id));
  });

  database.close();
};

export const replaceSnapshot = async (snapshot: PersistentStateSnapshot): Promise<void> => {
  const database = await openDatabase();

  const encryptedSnapshot = await Promise.all(PERSISTENT_STORES.map(async (storeName) => {
    const source = storeName === 'accounting_entries' ? snapshot.accountingEntries : snapshot[storeName];
    return [storeName, await Promise.all(source.map((record) => encryptRecord(record)))] as const;
  }));

  await runTransaction(database, [...PERSISTENT_STORES], 'readwrite', async (transaction) => {
    await Promise.all(encryptedSnapshot.map(async ([storeName, encryptedRecords]) => {
      const store = transaction.objectStore(storeName);
      await requestToPromise(store.clear());
      await Promise.all(encryptedRecords.map((record) => requestToPromise(store.put(record))));
    }));
  });

  database.close();
};

export const buildBackup = (snapshot: PersistentStateSnapshot) => ({
  schemaVersion: DATABASE_VERSION,
  exportedAt: new Date().toISOString(),
  architecture: 'mvp-local-indexeddb-encrypted',
  stores: snapshot,
});
