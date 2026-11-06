"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useDemoMode, PERM_MGMT, PERM_MSG, type DemoCaption } from "@/lib/demo";

interface PageStep extends DemoCaption {
  step: number;
}

/** What each screen demonstrates, in the order of the App Review video. */
function pageStep(path: string): PageStep | null {
  if (path === "/dashboard")
    return { step: 1, text: "The business connects its own WhatsApp Business account with Meta Embedded Signup.", permission: PERM_MGMT };
  if (path === "/templates/new")
    return { step: 3, text: "Creating a message template and submitting it to Meta for approval.", permission: PERM_MGMT };
  if (path.startsWith("/templates"))
    return { step: 2, text: "Templates are listed from the business's WhatsApp account, with Meta's approval status.", permission: PERM_MGMT };
  if (path === "/inbox/new")
    return { step: 4, text: "Sending an approved template message to a customer.", permission: PERM_MSG };
  if (path.startsWith("/inbox"))
    return { step: 5, text: "Customer replies arrive in the inbox. Free-form replies are allowed inside the 24-hour window.", permission: PERM_MSG };
  return null;
}

export function DemoCaptions() {
  const on = useDemoMode();
  const path = usePathname();
  const [flash, setFlash] = useState<DemoCaption | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onCaption(e: Event) {
      const c = (e as CustomEvent<DemoCaption>).detail;
      setFlash(c);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), c.ms ?? 6000);
    }
    window.addEventListener("vyapar-caption", onCaption);
    return () => {
      window.removeEventListener("vyapar-caption", onCaption);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!on) return null;
  const page = pageStep(path);
  const shown: (DemoCaption & { step?: number }) | null = flash ?? page;
  if (!shown) return null;
  const step = page?.step;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4"
    >
      <div className="max-w-3xl rounded-2xl bg-slate-900/95 px-6 py-4 text-white shadow-2xl ring-1 ring-white/10">
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          {step ? <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-white">Step {step} of 5</span> : null}
          {shown.permission ? (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-mono normal-case tracking-normal text-brand-100">
              Permission: {shown.permission}
            </span>
          ) : null}
        </div>
        <p className="text-lg font-medium leading-snug sm:text-xl">{shown.text}</p>
      </div>
    </div>
  );
}
