/**
 * postgres returns loosely typed rows. Annotating a query with a row type is an
 * assertion, not a check; these readers check, and name the offending column on failure.
 */
export type DbRow = Record<string, unknown>;

function read(row: DbRow, column: string): unknown {
  if (!(column in row)) {
    throw new Error(`Column "${column}" is missing from the query result.`);
  }
  return row[column];
}

function describe(value: unknown): string {
  return value === null ? 'null' : typeof value;
}

export function readNullableNumber(row: DbRow, column: string): number | null {
  const value = read(row, column);
  if (value === null) return null;
  // count(*) and other bigint results arrive as strings, to keep 64-bit precision.
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  if (typeof value === 'number') return value;
  throw new Error(`Column "${column}" holds ${describe(value)}, expected a number.`);
}

export function readNumber(row: DbRow, column: string): number {
  const value = readNullableNumber(row, column);
  if (value === null) throw new Error(`Column "${column}" is null, expected a number.`);
  return value;
}

export function readNullableString(row: DbRow, column: string): string | null {
  const value = read(row, column);
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new Error(`Column "${column}" holds ${describe(value)}, expected a string.`);
}

export function readString(row: DbRow, column: string): string {
  const value = readNullableString(row, column);
  if (value === null) throw new Error(`Column "${column}" is null, expected a string.`);
  return value;
}

export function readNullableBoolean(row: DbRow, column: string): boolean | null {
  const value = read(row, column);
  if (value === null || typeof value === 'boolean') return value;
  throw new Error(`Column "${column}" holds ${describe(value)}, expected a boolean.`);
}

/** timestamptz arrives as a Date; the rest of the code passes ISO strings around. */
export function readNullableIso(row: DbRow, column: string): string | null {
  const value = read(row, column);
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return new Date(value).toISOString();
  throw new Error(`Column "${column}" holds ${describe(value)}, expected a timestamp.`);
}

export function readIso(row: DbRow, column: string): string {
  const value = readNullableIso(row, column);
  if (value === null) throw new Error(`Column "${column}" is null, expected a timestamp.`);
  return value;
}

/** jsonb arrives as the raw text of the document, not as a parsed value. */
export function readStringArray(row: DbRow, column: string): string[] {
  const value = read(row, column);
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;

  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
    throw new Error(`Column "${column}" does not hold a list of strings.`);
  }
  return parsed as string[];
}
