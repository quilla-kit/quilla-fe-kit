import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localStorageTokenStorage } from '../src/local.storage.js';

class MemoryLocalStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }
  key(i: number): string | null {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('localStorageTokenStorage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemoryLocalStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips set + get + clear via globalThis.localStorage', async () => {
    const s = localStorageTokenStorage();
    expect(await s.getAccessToken()).toBeNull();

    await s.setTokens({ access: 'A', refresh: 'R' });
    expect(await s.getAccessToken()).toBe('A');
    expect(await s.getRefreshToken()).toBe('R');

    await s.clear();
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('honors custom keys', async () => {
    const s = localStorageTokenStorage({ accessKey: 'a', refreshKey: 'r' });
    await s.setTokens({ access: 'AA', refresh: 'RR' });
    expect((globalThis as { localStorage: Storage }).localStorage.getItem('a')).toBe('AA');
    expect((globalThis as { localStorage: Storage }).localStorage.getItem('r')).toBe('RR');
  });

  it('throws a clear error when localStorage is missing', async () => {
    vi.stubGlobal('localStorage', undefined);
    const s = localStorageTokenStorage();
    await expect(s.getAccessToken()).rejects.toThrow(/requires globalThis\.localStorage/);
  });
});
