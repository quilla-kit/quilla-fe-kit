import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createQueryInvalidator } from '../src/query-invalidator.factory.js';

describe('createQueryInvalidator', () => {
  it('calls invalidateQueries once per key with the correct shape', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const invalidator = createQueryInvalidator(queryClient);

    await invalidator.invalidate([['users'], ['roles', 'list']]);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['users'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['roles', 'list'] });
  });

  it('resolves without error when the key list is empty', async () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    const invalidator = createQueryInvalidator(queryClient);

    await invalidator.invalidate([]);

    expect(spy).not.toHaveBeenCalled();
  });

  it('delegates clear to the bound QueryClient', () => {
    const queryClient = new QueryClient();
    const spy = vi.spyOn(queryClient, 'clear');
    const invalidator = createQueryInvalidator(queryClient);

    invalidator.clear();

    expect(spy).toHaveBeenCalledOnce();
  });
});
