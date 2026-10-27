import { readFileSync } from "node:fs";

export function readFixture(testModuleUrl: string, name: string): string {
  return readFileSync(new URL(`fixtures/${name}`, testModuleUrl), "utf8");
}
