const decodeBase64Url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const normalized = pad ? padded + '='.repeat(4 - pad) : padded;
  const atobFn = (globalThis as { atob?: (data: string) => string }).atob;
  if (!atobFn) {
    throw new Error('jwt.parser: globalThis.atob is not available in this runtime.');
  }
  return atobFn(normalized);
};

export const decodeJwtPayload = <T>(token: string): T | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  if (!payload) return null;
  try {
    return JSON.parse(decodeBase64Url(payload)) as T;
  } catch {
    return null;
  }
};
