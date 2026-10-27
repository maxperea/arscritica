import { existsSync } from "node:fs";
import path from "node:path";

export function findWorkspaceRoot(start = process.cwd()): string {
  let dir = path.resolve(start);
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
  return dir;
}

export function defaultDbPath(): string {
  const fromEnv = process.env.ARSCRITICA_DB;
  if (fromEnv) return path.resolve(process.env.INIT_CWD ?? process.cwd(), fromEnv);
  return path.join(findWorkspaceRoot(), "data", "arscritica.db");
}
