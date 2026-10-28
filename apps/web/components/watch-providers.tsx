import type { MovieWatchProvider } from "@arscritica/db";
import { posterUrl } from "@/lib/format";

const groups = [
  { kind: "stream", label: "Streama" },
  { kind: "rent", label: "Hyr" },
  { kind: "buy", label: "Köp" },
] as const;

const primeVideo = {
  home: "https://www.primevideo.com",
  search: "https://www.primevideo.com/-/sv/search/ref=atv_sr_sug?phrase=",
};

const services: Record<string, { home: string; search?: string }> = {
  "Amazon Prime Video": primeVideo,
  "Amazon Video": primeVideo,
  "Apple TV": { home: "https://tv.apple.com/se" },
  "Apple TV Amazon Channel": primeVideo,
  "Apple TV Store": { home: "https://tv.apple.com/se" },
  Artiflix: { home: "https://artiflix.com" },
  Blockbuster: { home: "https://www.blockbuster.se" },
  Cineasterna: { home: "https://www.cineasterna.com/sv" },
  Cultpix: { home: "https://www.cultpix.com" },
  "Disney Plus": { home: "https://www.disneyplus.com/sv-se" },
  "DocAlliance Films": { home: "https://dafilms.com" },
  "Draken Film": { home: "https://www.drakenfilm.se" },
  "FOUND TV": { home: "https://foundtv.com" },
  "HBO Max": { home: "https://www.hbomax.com/se/sv" },
  "HBO Max Amazon Channel": primeVideo,
  "Lionsgate+ Amazon Channel": primeVideo,
  "MGM Amazon Channel": primeVideo,
  MUBI: { home: "https://mubi.com/sv/se" },
  "MUBI Amazon Channel": primeVideo,
  Netflix: { home: "https://www.netflix.com/se", search: "https://www.netflix.com/search?q=" },
  "Netflix Kids": { home: "https://www.netflix.com/se" },
  Plex: { home: "https://watch.plex.tv" },
  "Rakuten TV": { home: "https://www.rakuten.tv/se" },
  "SF Anytime": {
    home: "https://www.sfanytime.com/sv",
    search: "https://www.sfanytime.com/sv/search?query=",
  },
  "SVT Play": { home: "https://www.svtplay.se", search: "https://www.svtplay.se/sok?q=" },
  "Shadowz Amazon Channel": primeVideo,
  SkyShowtime: { home: "https://www.skyshowtime.com/se" },
  "TV4 Play": { home: "https://www.tv4play.se" },
  "Tele2 Play": { home: "https://www.tele2play.se", search: "https://www.tele2play.se/search?q=" },
  "TriArt Play": { home: "https://www.triart.se/play" },
  "True Story": { home: "https://www.truestory.film" },
  Viaplay: { home: "https://viaplay.se", search: "https://viaplay.se/search?query=" },
};

function providerUrl(provider: MovieWatchProvider, title: string): string | undefined {
  if (provider.url) return provider.url;
  const service = services[provider.name];
  if (!service) return undefined;
  return service.search ? service.search + encodeURIComponent(title) : service.home;
}

export function WatchProviders({
  providers,
  title,
}: {
  providers: MovieWatchProvider[];
  title: string;
}) {
  if (!providers.length) return null;
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
                  href={providerUrl(provider, title)}
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
    </section>
  );
}
