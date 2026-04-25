import { describe, expect, it } from 'vitest';
import { memoryTokenStorage } from '../src/memory.storage.js';

describe('memoryTokenStorage', () => {
  it('returns null before any tokens are set', async () => {
    const s = memoryTokenStorage();
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('round-trips set + get', async () => {
    const s = memoryTokenStorage();
    await s.setTokens({ access: 'A', refresh: 'R' });
    expect(await s.getAccessToken()).toBe('A');
    expect(await s.getRefreshToken()).toBe('R');
  });

  it('clear() resets to null', async () => {
    const s = memoryTokenStorage();
    await s.setTokens({ access: 'A', refresh: 'R' });
    await s.clear();
    expect(await s.getAccessToken()).toBeNull();
    expect(await s.getRefreshToken()).toBeNull();
  });

  it('separate instances do not share state', async () => {
    const a = memoryTokenStorage();
    const b = memoryTokenStorage();
    await a.setTokens({ access: 'A', refresh: 'R' });
    expect(await b.getAccessToken()).toBeNull();
  });
});
