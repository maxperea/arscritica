import { setTimeout as sleep } from "node:timers/promises";
import { parseRobots, type RobotsRules } from "./robots";
import type { Fetcher } from "./source";

export const USER_AGENT = "ArsCriticaBot/0.1 (+https://github.com/maxperea/arscritica)";

export class RobotsDisallowedError extends Error {
  constructor(url: string) {
    super(`Disallowed by robots.txt: ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export interface PoliteFetcherOptions {
  userAgent?: string;
  minDelayMs?: number;
  timeoutMs?: number;
}

export class PoliteFetcher implements Fetcher {
  private readonly userAgent: string;
  private readonly minDelayMs: number;
  private readonly timeoutMs: number;
  private readonly robotsByOrigin = new Map<string, Promise<RobotsRules>>();
  private readonly nextRequestAtByHost = new Map<string, number>();

  constructor(options: PoliteFetcherOptions = {}) {
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.minDelayMs = options.minDelayMs ?? 2000;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async fetchText(url: string): Promise<string> {
    const target = new URL(url);
    const robots = await this.robotsFor(target.origin);
    if (!robots.isAllowed(target.href)) throw new RobotsDisallowedError(target.href);
    const delayMs = Math.max(this.minDelayMs, (robots.crawlDelaySeconds ?? 0) * 1000);
    const response = await this.request(target, delayMs);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${target.href}`);
    return response.text();
  }

  private robotsFor(origin: string): Promise<RobotsRules> {
    let robots = this.robotsByOrigin.get(origin);
    if (!robots) {
      robots = this.loadRobots(origin);
      this.robotsByOrigin.set(origin, robots);
    }
    return robots;
  }

  private async loadRobots(origin: string): Promise<RobotsRules> {
    try {
      const response = await this.request(new URL("/robots.txt", origin), this.minDelayMs);
      if (response.status === 401 || response.status === 403) {
        return parseRobots("User-agent: *\nDisallow: /", this.userAgent);
      }
      return parseRobots(response.ok ? await response.text() : "", this.userAgent);
    } catch {
      return parseRobots("", this.userAgent);
    }
  }

  private async request(url: URL, delayMs: number): Promise<Response> {
    await this.waitForTurn(url.host, delayMs);
    return fetch(url, {
      headers: {
        "user-agent": this.userAgent,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private async waitForTurn(host: string, delayMs: number): Promise<void> {
    const now = Date.now();
    const startAt = Math.max(now, this.nextRequestAtByHost.get(host) ?? 0);
    this.nextRequestAtByHost.set(host, startAt + delayMs);
    if (startAt > now) await sleep(startAt - now);
  }
}
