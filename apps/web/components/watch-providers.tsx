import type { MovieWatchProvider } from "@arscritica/db";
import { posterUrl } from "@/lib/format";

const groups = [
  { kind: "stream", label: "Streama" },
  { kind: "rent", label: "Hyr" },
  { kind: "buy", label: "Köp" },
] as const;

const priceFormat = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });

const primeVideoSearch = "https://www.primevideo.com/-/sv/search/ref=atv_sr_sug?phrase=";

const searchUrls: Record<string, string> = {
  "SF Anytime": "https://www.sfanytime.com/sv/search?query=",
  Viaplay: "https://viaplay.se/search?query=",
  "Amazon Video": primeVideoSearch,
  "Amazon Prime Video": primeVideoSearch,
  "Tele2 Play": "https://www.tele2play.se/search?q=",
  "SVT Play": "https://www.svtplay.se/sok?q=",
  Netflix: "https://www.netflix.com/search?q=",
};

function providerUrl(provider: MovieWatchProvider, title: string, fallback: string): string {
  if (provider.url) return provider.url;
  const search = searchUrls[provider.name];
  return search ? search + encodeURIComponent(title) : fallback;
}

function formatPrice(price: number): string {
  return `${priceFormat.format(price)} kr`;
}

export function WatchProviders({
  providers,
  title,
  tmdbId,
}: {
  providers: MovieWatchProvider[];
  title: string;
  tmdbId: number;
}) {
  if (!providers.length) return null;
  const link = `https://www.themoviedb.org/movie/${tmdbId}/watch?locale=SE`;
  return (
    <section className="watch">
      {groups.map(({ kind, label }) => {
        const names = new Set<string>();
        const matching = providers.filter(
          (provider) =>
            provider.kind === kind && !names.has(provider.name) && names.add(provider.name),
        );
        if (!matching.length) return null;
        return (
          <div key={kind} className="watch-row">
            <span className="watch-label muted">{label}</span>
            <div className="watch-logos">
              {matching.map((provider) => (
                <a
                  key={provider.name}
                  className="watch-option"
                  href={providerUrl(provider, title, link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={provider.name}
                >
                  {provider.logoPath ? (
                    <img
                      className="watch-logo"
                      src={posterUrl(provider.logoPath, "w92")}
                      alt={provider.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="watch-name">{provider.name}</span>
                  )}
                  {provider.price !== null && (
                    <span className="watch-price muted">{formatPrice(provider.price)}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
