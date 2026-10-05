import type { MutationSuccessHandler } from '@quilla-fe-kit/api-client-react-query';
import type { MutationMeta, QueryMeta, UseMutationOptions } from '@tanstack/react-query';
import { afterEach, describe, expectTypeOf, it } from 'vitest';
import { createQueryClient, resetQueryClient } from '../src/query-client.factory.js';

// Augments through the package name, as consumers do. Declaration merging is global to the
// test program, so every test file sees this field on mutation meta.
declare module '@quilla-fe-kit/api-client-react-query' {
  interface MutationMetaExtensions {
    successDetail?: string;
  }
}

describe('meta extensions', () => {
  afterEach(() => {
    resetQueryClient();
  });

  it('merges app fields into mutation meta alongside the built-ins', () => {
    expectTypeOf<MutationMeta['successDetail']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<MutationMeta['showError']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<keyof MutationMeta>().toEqualTypeOf<
      | 'showSuccess'
      | 'showWarning'
      | 'customSuccessMessage'
      | 'customErrorMessage'
      | 'showError'
      | 'successDetail'
    >();
  });

  it('keeps query meta typed and free of mutation extensions', () => {
    expectTypeOf<QueryMeta['showSuccess']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<QueryMeta>().not.toHaveProperty('successDetail');
    expectTypeOf<QueryMeta>().not.toHaveProperty('showError');
  });

  it('exposes extensions to the global mutation callbacks', () => {
    expectTypeOf<Parameters<MutationSuccessHandler>[1]['meta']>().toEqualTypeOf<
      MutationMeta | undefined
    >();
    createQueryClient({
      onMutationSuccess: (_data, mutation) => {
        expectTypeOf(mutation.meta?.successDetail).toEqualTypeOf<string | undefined>();
      },
    });
  });

  it('still rejects unknown keys and mistyped extension fields', () => {
    type OptionsMeta = UseMutationOptions['meta'];
    // @ts-expect-error — typo of a built-in key
    const typo: OptionsMeta = { showSucess: true };
    // @ts-expect-error — extension fields keep their declared type
    const mistyped: OptionsMeta = { successDetail: 42 };
    const valid: OptionsMeta = { showSuccess: true, successDetail: 'Saved as draft' };
    void [typo, mistyped, valid];
  });
});
