import { describe, expect, it } from 'vitest';
import {
  BadRequestError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  QuillaFeError,
  QuillaFeHttpError,
  UnauthorizedError,
  ValidationError,
} from '../src/index.js';

const HTTP_OPTS = { httpStatus: 409, requestUrl: '/x' };

describe('QuillaFeError', () => {
  it('is recognizable across realms via Symbol.for brand', () => {
    const err = new ConflictError({ message: 'conflict', ...HTTP_OPTS });
    expect(QuillaFeError.is(err)).toBe(true);
    expect(QuillaFeError.is(new NetworkError({ message: 'down' }))).toBe(true);
    expect(QuillaFeError.is(new Error('plain'))).toBe(false);
    expect(QuillaFeError.is(null)).toBe(false);
    expect(QuillaFeError.is({ [Symbol.for('quilla-fe-kit.error')]: true })).toBe(true);
  });

  it('sets name to the constructor name', () => {
    expect(new BadRequestError({ message: 'x', httpStatus: 400, requestUrl: '/x' }).name).toBe(
      'BadRequestError',
    );
    expect(
      new BusinessRuleError({ message: 'x', httpStatus: 422, requestUrl: '/x' }).name,
    ).toBe('BusinessRuleError');
    expect(new NetworkError({ message: 'x' }).name).toBe('NetworkError');
  });

  it('serializes to JSON with name, code, message, optional context, optional cause', () => {
    const cause = new Error('upstream');
    const err = new ValidationError({
      message: 'invalid',
      context: { field: 'email' },
      httpStatus: 422,
      requestUrl: '/users',
      cause,
    });

    expect(err.toJSON()).toEqual({
      name: 'ValidationError',
      code: 'VALIDATION',
      message: 'invalid',
      context: { field: 'email' },
      httpStatus: 422,
      requestUrl: '/users',
      cause,
    });
  });

  it('omits context and cause from JSON when not provided', () => {
    const err = new NotFoundError({ message: 'gone', httpStatus: 404, requestUrl: '/x' });
    expect(err.toJSON()).toEqual({
      name: 'NotFoundError',
      code: 'NOT_FOUND',
      message: 'gone',
      httpStatus: 404,
      requestUrl: '/x',
    });
  });

  it.each([
    [BadRequestError, 'BAD_REQUEST'],
    [UnauthorizedError, 'UNAUTHORIZED'],
    [ForbiddenError, 'FORBIDDEN'],
    [NotFoundError, 'NOT_FOUND'],
    [ConflictError, 'CONFLICT'],
    [ValidationError, 'VALIDATION'],
    [BusinessRuleError, 'BUSINESS_RULE'],
    [InternalServerError, 'INTERNAL_SERVER'],
  ])('%s carries code %s and is a QuillaFeHttpError', (Cls, expectedCode) => {
    const err = new Cls({ message: 'x', httpStatus: 500, requestUrl: '/u' });
    expect(err.code).toBe(expectedCode);
    expect(err).toBeInstanceOf(QuillaFeError);
    expect(err).toBeInstanceOf(QuillaFeHttpError);
    expect(err.httpStatus).toBe(500);
    expect(err.requestUrl).toBe('/u');
  });

  it('NetworkError carries code NETWORK and is NOT a QuillaFeHttpError', () => {
    const err = new NetworkError({ message: 'offline' });
    expect(err.code).toBe('NETWORK');
    expect(err).toBeInstanceOf(QuillaFeError);
    expect(err).not.toBeInstanceOf(QuillaFeHttpError);
  });

  it('JSON for NetworkError omits httpStatus + requestUrl', () => {
    const err = new NetworkError({ message: 'offline' });
    expect(err.toJSON()).toEqual({
      name: 'NetworkError',
      code: 'NETWORK',
      message: 'offline',
    });
  });
});
