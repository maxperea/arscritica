import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import type { WatchKind, WatchOffer } from "@arscritica/db";
import { USER_AGENT } from "./fetcher";

interface WatchmodeSource {
  name: string;
  type: string;
  web_url?: string | null;
  price?: number | null;
}

const watchKinds: Record<string, WatchKind> = {
  sub: "stream",
  free: "stream",
  rent: "rent",
  buy: "buy",
};

const idMapUrl = "https://api.watchmode.com/datasets/title_id_map.csv";

export class WatchmodeQuotaExhausted extends Error {}

export class WatchmodeClient {
  creditsLeft = Infinity;

  constructor(private readonly apiKey: string) {}

  static fromEnv(): WatchmodeClient | undefined {
    const apiKey = process.env.WATCHMODE_API_KEY;
    return apiKey ? new WatchmodeClient(apiKey) : undefined;
  }

  async swedishOffers(titleId: number | string): Promise<WatchOffer[]> {
    const response = await fetch(
      `https://api.watchmode.com/v1/title/${titleId}/sources/?regions=SE`,
      { headers: { "X-API-Key": this.apiKey, "User-Agent": USER_AGENT } },
    );
    const quota = Number(response.headers.get("x-account-quota"));
    const used = Number(response.headers.get("x-account-quota-used"));
    if (quota && !Number.isNaN(used)) this.creditsLeft = quota - used;
    if (response.status === 404) return [];
    if (response.status === 429 || response.status === 402) {
      throw new WatchmodeQuotaExhausted(`Watchmode responded ${response.status}`);
    }
    if (!response.ok) throw new Error(`Watchmode responded ${response.status}`);
    return cheapestOffers((await response.json()) as WatchmodeSource[]);
  }

  async watchmodeIds(tmdbIds: Set<number>): Promise<Map<number, number>> {
    const response = await fetch(idMapUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok || !response.body) {
      throw new Error(`Watchmode ID map responded ${response.status}`);
    }
    const ids = new Map<number, number>();
    const lines = createInterface({
      input: Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    });
    for await (const line of lines) {
      const match = /^"(\d+)","[^"]*","(\d+)","movie"/.exec(line);
      if (match && tmdbIds.has(Number(match[2]))) ids.set(Number(match[2]), Number(match[1]));
    }
    return ids;
  }
}

function cheapestOffers(sources: WatchmodeSource[]): WatchOffer[] {
  const offers = new Map<string, WatchOffer>();
  for (const source of sources) {
    const kind = watchKinds[source.type];
    if (!kind || !source.web_url) continue;
    const key = `${kind}:${source.name}`;
    const price = source.price ?? undefined;
    const existing = offers.get(key);
    if (!existing) {
      offers.set(key, { kind, name: source.name, url: source.web_url, price });
    } else if (price !== undefined && (existing.price === undefined || price < existing.price)) {
      existing.price = price;
    }
  }
  return [...offers.values()];
}
