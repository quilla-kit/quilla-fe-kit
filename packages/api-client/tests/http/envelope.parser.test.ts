import { describe, expect, it } from 'vitest';
import {
  BadRequestError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@quilla-fe-kit/errors';
import { EnvelopeHttpErrorParser } from '../../src/http/envelope.parser.js';

const parser = new EnvelopeHttpErrorParser();

describe('EnvelopeHttpErrorParser.fromResponse', () => {
  it.each([
    [400, BadRequestError],
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [412, ConflictError],
    [422, ValidationError],
    [500, InternalServerError],
  ])('status %i without name → %s', (status, ExpectedCls) => {
    const err = parser.fromResponse(status, 'X', undefined, '/foo');
    expect(err).toBeInstanceOf(ExpectedCls);
  });

  it('falls back to InternalServerError on unmapped status', () => {
    expect(parser.fromResponse(599, 'Custom', undefined, '/u')).toBeInstanceOf(
      InternalServerError,
    );
  });

  it('dispatches by error.name when present, overriding status', () => {
    const body = { error: { name: 'BusinessRuleError', message: 'rule failed' } };
    const err = parser.fromResponse(400, 'Bad Request', body, '/x');
    expect(err).toBeInstanceOf(BusinessRuleError);
    expect(err.message).toBe('rule failed');
  });

  it('falls back to status when error.name is unknown', () => {
    const body = { error: { name: 'WeirdError', message: 'who knows' } };
    const err = parser.fromResponse(409, 'Conflict', body, '/x');
    expect(err).toBeInstanceOf(ConflictError);
  });

  it('uses statusText as message when envelope is absent', () => {
    const err = parser.fromResponse(404, 'Not Found', undefined, '/x');
    expect(err.message).toBe('Not Found');
  });

  it('puts envelope details into context (domain only) and httpStatus/requestUrl on the error', () => {
    const body = { error: { name: 'ValidationError', message: 'bad', details: { field: 'email' } } };
    const err = parser.fromResponse(422, 'Unprocessable', body, '/users');
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).context).toEqual({ field: 'email' });
    expect((err as ValidationError).httpStatus).toBe(422);
    expect((err as ValidationError).requestUrl).toBe('/users');
  });

  it('omits context entirely when details are absent', () => {
    const err = parser.fromResponse(404, 'Not Found', undefined, '/x');
    expect((err as NotFoundError).context).toBeUndefined();
    expect((err as NotFoundError).httpStatus).toBe(404);
    expect((err as NotFoundError).requestUrl).toBe('/x');
  });
});

describe('EnvelopeHttpErrorParser.fromTransportError', () => {
  it('AbortError → NetworkError carrying the original cause', () => {
    const abort = new DOMException('aborted', 'AbortError');
    const err = parser.fromTransportError(abort);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).cause).toBe(abort);
    expect(err.message).toBe('aborted');
  });

  it('TypeError → NetworkError', () => {
    const te = new TypeError('Failed to fetch');
    const err = parser.fromTransportError(te);
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).cause).toBe(te);
  });

  it('generic Error → NetworkError', () => {
    const e = new Error('boom');
    const err = parser.fromTransportError(e);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toBe('boom');
  });

  it('non-Error → NetworkError with default message', () => {
    const err = parser.fromTransportError({ weird: true });
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.message).toBe('Unknown transport error');
  });
});
