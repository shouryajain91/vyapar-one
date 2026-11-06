"use client";

import { setDemoMode, useDemoMode } from "@/lib/demo";

/** Sidebar switch for Review mode (on-screen captions for the App Review video). */
export function DemoToggle() {
  const on = useDemoMode();
  return (
    <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
      <span className="text-sm text-slate-700">
        Review mode
        <span className="block text-xs text-slate-500">On-screen captions</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Review mode"
        onClick={() => setDemoMode(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-brand-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}
