"use client";
import { useEffect, useState } from "react";

const TTL_MS = 5 * 60_000;

/** GETs JSON once and remembers it for 5 minutes in this tab, so revisiting a page is instant. */
export function useCachedFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `cf:${url}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const { t, d } = JSON.parse(raw);
        if (Date.now() - t < TTL_MS) {
          queueMicrotask(() => !cancelled && setData(d as T));
          return () => { cancelled = true; };
        }
      }
    } catch {}
    fetch(url)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (!r.ok) return setError(d.error ?? "Could not load");
        setData(d as T);
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch {}
      })
      .catch(() => !cancelled && setError("Could not load"));
    return () => { cancelled = true; };
  }, [url]);

  return { data, error };
}
