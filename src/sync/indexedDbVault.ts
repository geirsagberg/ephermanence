import type { SyncState, SyncVault } from './spaceSync'

const databaseName = 'ephermanence-sync'
const storeName = 'vault'
const recordKey = 'state'

/** Keeps the non-extractable space key and the merge base in IndexedDB, which can store CryptoKeys. */
export function indexedDbVault(): SyncVault {
  let database: Promise<IDBDatabase> | null = null
  const open = () =>
    (database ??= request(
      Object.assign(indexedDB.open(databaseName, 1), {
        onupgradeneeded(this: IDBOpenDBRequest) {
          this.result.createObjectStore(storeName)
        },
      }),
    ))

  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open()
    return request(action(db.transaction(storeName, mode).objectStore(storeName)))
  }

  return {
    load: async () => ((await run('readonly', (store) => store.get(recordKey))) as SyncState | undefined) ?? null,
    save: async (state) => {
      await run('readwrite', (store) => store.put(state, recordKey))
    },
    clear: async () => {
      await run('readwrite', (store) => store.delete(recordKey))
    },
  }
}

function request<T>(pending: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    pending.onsuccess = () => resolve(pending.result)
    pending.onerror = () => reject(pending.error)
  })
}
