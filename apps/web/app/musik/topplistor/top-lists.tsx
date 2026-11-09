"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopListAlbum } from "@arscritica/db";
import { AlbumList } from "@/components/album-list";
import {
  allPeriod,
  periodLabel,
  periodMovies,
  periods,
  recentDays,
  recentPeriod,
} from "@/lib/top-list";

const pageSize = 50;

interface Selection {
  period: string;
  now: number;
}

export function AlbumTopLists({ albums }: { albums: TopListAlbum[] }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [showAll, setShowAll] = useState(false);
  const periodOptions = useMemo(() => periods(albums), [albums]);

  useEffect(() => {
    const period = new URLSearchParams(window.location.search).get("period") ?? "";
    setSelection({
      now: Date.now(),
      period: periodOptions.includes(period) ? period : recentPeriod,
    });
  }, [periodOptions]);

  const results = useMemo(
    () => (selection ? periodMovies(albums, selection.period, selection.now) : []),
    [albums, selection],
  );

  if (!selection) {
    return (
      <p className="muted caption" role="status">
        Laddar album…
      </p>
    );
  }

  function selectPeriod(period: string) {
    if (!selection) return;
    setSelection({ ...selection, period });
    setShowAll(false);
    const query = period === recentPeriod ? "" : `?period=${period}`;
    window.history.replaceState(null, "", query || window.location.pathname);
  }

  const { period } = selection;
  const visible = showAll ? results : results.slice(0, pageSize);
  const alternative = periodOptions.find(
    (option) => option !== period && periodMovies(albums, option, selection.now).length > 0,
  );

  return (
    <>
      <div className="filters">
        <div className="filter-field">
          <label htmlFor="period">Period</label>
          <select
            id="period"
            className="filter-select"
            value={period}
            onChange={(event) => selectPeriod(event.target.value)}
          >
            {periodOptions.map((option) => (
              <option key={option} value={option}>
                {option === allPeriod ? "Alla perioder" : periodLabel(option)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {period !== recentPeriod && (
        <div className="filter-summary">
          <span className="muted">{periodLabel(period)}</span>
          <button type="button" className="text-button" onClick={() => selectPeriod(recentPeriod)}>
            Återställ filter
          </button>
        </div>
      )}
      {results.length ? (
        <>
          <p className="muted caption" role="status">
            {[periodCaption(period), results.length === 1 ? "1 album" : `${results.length} album`]
              .filter(Boolean)
              .join(" · ")
              .replace(/^./, (letter) => letter.toUpperCase())}
          </p>
          <AlbumList albums={visible} />
          {visible.length < results.length && (
            <button type="button" className="button show-more" onClick={() => setShowAll(true)}>
              Visa fler
            </button>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p role="status">Inga album{emptyPeriodPhrase(period)}.</p>
          {alternative && (
            <div className="empty-actions">
              <button type="button" className="button" onClick={() => selectPeriod(alternative)}>
                Visa {alternative === allPeriod ? "alla perioder" : periodLabel(alternative)}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function periodCaption(period: string): string {
  if (period === recentPeriod) return `nya album recenserade senaste ${recentDays} dagarna`;
  if (period === allPeriod) return "";
  return `utgivna ${period}`;
}

function emptyPeriodPhrase(period: string): string {
  if (period === recentPeriod) return ` under de senaste ${recentDays} dagarna`;
  if (period === allPeriod) return "";
  return ` utgivna ${period}`;
}
