import type { SQLOutputValue } from 'node:sqlite';

/**
 * What node:sqlite hands back: a bag of columns, each holding one of five loose types.
 * Casting such a row to an interface with `as` proves nothing, it only silences the
 * compiler. Rename a column in a migration and the cast keeps claiming the field is a
 * number while it is actually `undefined`, which then spreads quietly through the code.
 *
 * These readers check instead, and name the offending column when they fail, so the
 * error points at the query rather than at whatever broke three functions later.
 */
export type DbRow = Record<string, SQLOutputValue>;

function read(row: DbRow, column: string): SQLOutputValue {
  const value = row[column];
  // SQLOutputValue covers null, so undefined can only mean the column is not there.
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
  // count(*) and lastInsertRowid come back as bigint; every id we store fits in a number.
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

/** SQLite has no boolean type; the schema constrains these columns to 0 and 1. */
export function readNullableBoolean(row: DbRow, column: string): boolean | null {
  const value = readNullableNumber(row, column);
  return value === null ? null : value !== 0;
}
