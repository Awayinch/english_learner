import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';

/**
 * Custom Storage Adapter for Zustand.
 * Bridges Zustand's JSON persistence to IndexedDB (via idb-keyval).
 * 
 * Why: localStorage is synchronous and limited to 5MB. 
 * IndexedDB is asynchronous and handles large blobs (images/long chat history).
 */
export const indexedDBStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // 1. Try fetching from IndexedDB
    const value = await get(name);
    
    // 2. Migration Strategy: If not in DB, check localStorage (Legacy)
    if (value === undefined || value === null) {
        const legacyValue = localStorage.getItem(name);
        if (legacyValue) {
            console.log(`[Migration] Moving ${name} from localStorage to IndexedDB`);
            await set(name, legacyValue); // Save to DB
            // We don't delete from localStorage immediately to be safe, 
            // but effectively we are reading it.
            return legacyValue;
        }
        return null;
    }
    
    return value || null;
  },
  
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};
