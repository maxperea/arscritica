export interface RobotsRules {
  crawlDelaySeconds?: number;
  isAllowed(url: string): boolean;
}

interface Rule {
  allow: boolean;
  pattern: string;
}

interface Group {
  agents: string[];
  rules: Rule[];
  crawlDelay?: number;
}

export function parseRobots(text: string, userAgent: string): RobotsRules {
  const groups = parseGroups(text);
  const token = userAgent.split("/")[0]!.toLowerCase();
  const group =
    groups.find((g) => g.agents.includes(token)) ?? groups.find((g) => g.agents.includes("*"));
  const rules = group?.rules ?? [];

  return {
    crawlDelaySeconds: group?.crawlDelay,
    isAllowed(url) {
      const { pathname, search } = new URL(url);
      const target = pathname + search;
      let best: { allow: boolean; length: number } | undefined;
      for (const rule of rules) {
        if (!matchesPattern(rule.pattern, target)) continue;
        const length = rule.pattern.length;
        if (!best || length > best.length || (length === best.length && rule.allow)) {
          best = { allow: rule.allow, length };
        }
      }
      return best?.allow ?? true;
    },
  };
}

function parseGroups(text: string): Group[] {
  const groups: Group[] = [];
  let current: Group | undefined;
  let previousWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !previousWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      previousWasAgent = true;
      continue;
    }
    previousWasAgent = false;
    if (!current) continue;

    if ((field === "allow" || field === "disallow") && value) {
      current.rules.push({ allow: field === "allow", pattern: value });
    } else if (field === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay)) current.crawlDelay = delay;
    }
  }
  return groups;
}

function matchesPattern(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const regex = body.split("*").map(escapeRegExp).join(".*");
  return new RegExp(`^${regex}${anchored ? "$" : ""}`).test(path);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
