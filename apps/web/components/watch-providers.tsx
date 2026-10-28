import type { MovieWatchProvider } from "@arscritica/db";
import { posterUrl } from "@/lib/format";

const groups = [
  { kind: "stream", label: "Streama" },
  { kind: "rent", label: "Hyr" },
  { kind: "buy", label: "Köp" },
] as const;

const priceFormat = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });

function formatPrice(price: number): string {
  return `${priceFormat.format(price)} kr`;
}

export function WatchProviders({
  providers,
  tmdbId,
}: {
  providers: MovieWatchProvider[];
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
                  href={provider.url ?? link}
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
