"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches the page's server data every few seconds while something is in progress. */
export function AutoRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) router.refresh(); }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
