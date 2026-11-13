export type UrlResolver<TVars> = (vars: TVars) => string;

const PLACEHOLDER = /^:([A-Za-z_]\w*)$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const placeholderName = (segment: string): string | undefined => PLACEHOLDER.exec(segment)?.[1];

const substitutionSource = (vars: unknown): Record<string, unknown> => {
  if (!isPlainObject(vars)) return { id: vars };
  return { ...vars, ...(isPlainObject(vars.params) ? vars.params : {}) };
};

const urlError = (problem: string, basePath: string): Error =>
  new Error(
    `[url] ${problem} in '${basePath}'. Pass it in the variables or params, or supply resolveUrl.`,
  );

const encodePathValue = (name: string, value: unknown, basePath: string): string => {
  if (value === undefined || value === null || value === '') {
    throw urlError(`Could not resolve path placeholder ':${name}'`, basePath);
  }
  if (typeof value === 'object') {
    throw urlError(`Path placeholder ':${name}' resolved to a non-scalar value`, basePath);
  }
  return encodeURIComponent(String(value));
};

const substitutePlaceholders = (basePath: string, vars: unknown): string | undefined => {
  const segments = basePath.split('/');
  if (!segments.some((segment) => placeholderName(segment) !== undefined)) return undefined;
  const source = substitutionSource(vars);
  return segments
    .map((segment) => {
      const name = placeholderName(segment);
      return name === undefined ? segment : encodePathValue(name, source[name], basePath);
    })
    .join('/');
};

export const resolvePathParams = (basePath: string, vars: unknown): string =>
  substitutePlaceholders(basePath, vars) ?? basePath;

export const resolveMutationUrl = (basePath: string, vars: unknown): string => {
  const substituted = substitutePlaceholders(basePath, vars);
  if (substituted !== undefined) return substituted;

  const source = substitutionSource(vars);
  if (source.id === undefined || source.id === null || source.id === '') {
    throw urlError("No path placeholders and no 'id' on the mutation variables", basePath);
  }
  return `${basePath.replace(/\/+$/, '')}/${encodePathValue('id', source.id, basePath)}`;
};
