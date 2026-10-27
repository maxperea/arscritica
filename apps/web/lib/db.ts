import { openDatabase, type Database } from "@arscritica/db";

let database: Database | undefined;

export function getDb(): Database {
  database ??= openDatabase({ mustExist: true, migrate: false });
  return database;
}
