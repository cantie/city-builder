export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageAdapter {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  getItem(key: string): string | null {
    return globalThis.localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    globalThis.localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    globalThis.localStorage.removeItem(key);
  }
}
