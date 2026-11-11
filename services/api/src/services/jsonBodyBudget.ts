// Bound parsed network JSON before schema validators can accumulate issues.
// Not a schema replacement, persisted-state parser or multipart/upload limit.
export class JsonBodyBudgetError extends Error {
  statusCode = 413;
  code = 'BODY_STRUCTURE_TOO_LARGE';
  constructor() {
    super('This request is too complex. Please send fewer items.');
  }
}

export function assertBoundedJson(body: unknown): void {
  const pending: { value: unknown; depth: number }[] = [{ value: body, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++visited > 8192 || depth > 16) throw new JsonBodyBudgetError();
    if (typeof value === 'string') {
      if (value.length > 64 * 1024) throw new JsonBodyBudgetError();
      continue;
    }
    if (value === null || typeof value === 'number' || typeof value === 'boolean') continue;
    if (!value || typeof value !== 'object') throw new JsonBodyBudgetError();
    if (Array.isArray(value)) {
      if (value.length > 256 || visited + pending.length + value.length > 8192) throw new JsonBodyBudgetError();
      for (const item of value) pending.push({ value: item, depth: depth + 1 });
    } else {
      const keys = Object.keys(value);
      if (keys.length > 128 || visited + pending.length + keys.length > 8192) throw new JsonBodyBudgetError();
      for (const key of keys) {
        if (key.length > 256) throw new JsonBodyBudgetError();
        pending.push({ value: (value as Record<string, unknown>)[key], depth: depth + 1 });
      }
    }
  }
}
