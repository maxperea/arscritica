import type { MovieWatchProvider } from "@arscritica/db";
import { Fragment } from "react";

const displayNames: Record<string, string> = {
  "Apple TV Store": "Apple TV",
  "Amazon Video": "Amazon",
  "Amazon Prime Video": "Prime Video",
};

function displayName(name: string) {
  return displayNames[name] ?? name.replace(/ Amazon Channel$/, " via Prime Video");
}

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

function storeLabel(providers: MovieWatchProvider[]) {
  const rents = providers.some((provider) => provider.kind === "rent");
  const buys = providers.some((provider) => provider.kind === "buy");
  if (rents && buys) return "Hyr eller köp";
  return rents ? "Hyr" : "Köp";
}

function uniqueByName(providers: MovieWatchProvider[]) {
  const names = new Set<string>();
  return providers.filter((provider) => !names.has(provider.name) && names.add(provider.name));
}

function ProviderLinks({ providers, title }: { providers: MovieWatchProvider[]; title: string }) {
  return providers.map((provider, index) => {
    const href = providerUrl(provider, title);
    const name = displayName(provider.name);
    const separator = index === 0 ? "" : index === providers.length - 1 ? " och " : ", ";
    return (
      <Fragment key={provider.name}>
        {separator}
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {name}
          </a>
        ) : (
          name
        )}
      </Fragment>
    );
  });
}

export function WatchProviders({
  providers,
  title,
}: {
  providers: MovieWatchProvider[];
  title: string;
}) {
  const streaming = uniqueByName(providers.filter((provider) => provider.kind === "stream"));
  const store = providers.filter((provider) => provider.kind !== "stream");
  const stores = uniqueByName(store);
  return (
    <section className="watch">
      <h2>Se filmen</h2>
      <div>
        {!streaming.length && !stores.length ? (
          <p className="muted">Vi saknar uppgifter om var filmen kan ses.</p>
        ) : null}
        {streaming.length > 0 && (
          <p>
            <strong>Streama</strong> på <ProviderLinks providers={streaming} title={title} />.
          </p>
        )}
        {stores.length > 0 && (
          <p>
            <strong>{storeLabel(store)}</strong> på{" "}
            <ProviderLinks providers={stores} title={title} />.
          </p>
        )}
      </div>
    </section>
  );
}
