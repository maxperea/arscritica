import { albumSearchIndex } from "@arscritica/db";
import { withListCovers } from "@/lib/covers";
import { getDb } from "@/lib/db";

export const dynamic = "force-static";

export function GET() {
  return Response.json(withListCovers(albumSearchIndex(getDb())));
}
