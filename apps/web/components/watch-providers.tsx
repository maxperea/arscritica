import type { MovieWatchProvider } from "@arscritica/db";
import { posterUrl } from "@/lib/format";

const groups = [
  { kind: "stream", label: "Streama" },
  { kind: "rent", label: "Hyr" },
  { kind: "buy", label: "Köp" },
] as const;

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
                  href={link}
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
                </a>
              ))}
            </div>
          </div>
        );
      })}
      <p className="watch-credit muted">
        Källa:{" "}
        <a
          href="https://www.justwatch.com/se"
          className="quiet-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          JustWatch
        </a>
      </p>
    </section>
  );
}
