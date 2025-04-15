/**
 * Simple in-memory storage for agent memory
 * In a production environment, this would be replaced with persistent storage
 */

// Type definition for memory entries
export interface MemoryEntry {
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Memory store class for agent memory management
 */
export class MemoryStore {
  private static instance: MemoryStore;
  private memories: Map<string, MemoryEntry>;

  private constructor() {
    this.memories = new Map<string, MemoryEntry>();
  }

  /**
   * Get the singleton instance of MemoryStore
   */
  public static getInstance(): MemoryStore {
    if (!MemoryStore.instance) {
      MemoryStore.instance = new MemoryStore();
    }
    return MemoryStore.instance;
  }

  /**
   * Store a new memory or update an existing one
   */
  public store(key: string, value: string): MemoryEntry {
    const now = new Date();
    const existingMemory = this.memories.get(key);
    
    const memoryEntry: MemoryEntry = {
      key,
      value,
      createdAt: existingMemory ? existingMemory.createdAt : now,
      updatedAt: now,
    };
    
    this.memories.set(key, memoryEntry);
    return memoryEntry;
  }

  /**
   * Retrieve a memory by key
   */
  public retrieve(key: string): MemoryEntry | undefined {
    return this.memories.get(key);
  }

  /**
   * Delete a memory by key
   */
  public forget(key: string): boolean {
    return this.memories.delete(key);
  }

  /**
   * Get all stored memories
   */
  public getAllMemories(): MemoryEntry[] {
    return Array.from(this.memories.values());
  }

  /**
   * Clear all memories
   */
  public clearAll(): void {
    this.memories.clear();
  }
}