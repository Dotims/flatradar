import type { SQLOutputValue } from 'node:sqlite';

/**
 * node:sqlite returns loosely typed rows. An `as` cast on one proves nothing; these
 * readers check, and name the offending column when they fail.
 */
export type DbRow = Record<string, SQLOutputValue>;

function read(row: DbRow, column: string): SQLOutputValue {
  const value = row[column];
  // SQLOutputValue covers null, so undefined means the column is absent.
  if (value === undefined) {
    throw new Error(`Column "${column}" is missing from the query result.`);
  }
  return value;
}

function describe(value: SQLOutputValue): string {
  return value === null ? 'null' : typeof value;
}

export function readNullableNumber(row: DbRow, column: string): number | null {
  const value = read(row, column);
  if (value === null) return null;
  // count(*) and lastInsertRowid come back as bigint.
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  throw new Error(`Column "${column}" holds ${describe(value)}, expected a number.`);
}

export function readNumber(row: DbRow, column: string): number {
  const value = readNullableNumber(row, column);
  if (value === null) {
    throw new Error(`Column "${column}" is null, expected a number.`);
  }
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
  if (value === null) {
    throw new Error(`Column "${column}" is null, expected a string.`);
  }
  return value;
}

/** SQLite has no boolean type. */
export function readNullableBoolean(row: DbRow, column: string): boolean | null {
  const value = readNullableNumber(row, column);
  return value === null ? null : value !== 0;
}
