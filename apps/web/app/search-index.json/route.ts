import { searchIndex } from "@arscritica/db";
import { getDb } from "@/lib/db";

export const dynamic = "force-static";

export function GET() {
  return Response.json(searchIndex(getDb()));
}
