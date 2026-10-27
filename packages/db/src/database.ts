import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations";
import { defaultDbPath } from "./paths";
import { getRow } from "./sql";

export type Database = DatabaseSync;

export interface OpenDatabaseOptions {
  path?: string;
  mustExist?: boolean;
  migrate?: boolean;
}

export function openDatabase(options: OpenDatabaseOptions = {}): Database {
  const file = options.path ?? defaultDbPath();
  if (file !== ":memory:") {
    if (options.mustExist && !existsSync(file)) {
      throw new Error(`No database at ${file}. Run "pnpm seed" (sample data) or "pnpm scrape".`);
    }
    mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (options.migrate ?? true) migrate(db);
  return db;
}

function migrate(db: Database): void {
  const current = getRow<{ user_version: number }>(db.prepare("PRAGMA user_version"))!.user_version;
  for (let version = current; version < migrations.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(migrations[version]!);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
