import { openDatabase } from "./database";
import { defaultDbPath } from "./paths";

openDatabase().close();
console.log(`Database at ${defaultDbPath()} is up to date.`);
