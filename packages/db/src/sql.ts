import type { StatementSync } from "node:sqlite";

type Param = null | number | bigint | string;

export function getRow<T = Record<string, unknown>>(
  statement: StatementSync,
  ...params: Param[]
): T | undefined {
  const row = statement.get(...params) as object | undefined;
  return row ? ({ ...row } as T) : undefined;
}

export function allRows<T>(statement: StatementSync, ...params: Param[]): T[] {
  return (statement.all(...params) as object[]).map((row) => ({ ...row }) as T);
}
