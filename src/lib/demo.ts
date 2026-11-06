"use client";

import { useSyncExternalStore } from "react";

/**
 * "Review mode": shows on-screen captions that name each step and the Meta
 * permission it uses, so an App Review screencast needs no voice-over.
 * The flag is a per-browser preference (localStorage).
 */
const KEY = "vyapar-review-mode";
const CHANGE = "vyapar-review-mode-change";

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDemoMode(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

export function setDemoMode(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable: ignore */
  }
  window.dispatchEvent(new Event(CHANGE));
}

export interface DemoCaption {
  text: string;
  /** Meta permission this step demonstrates, shown as a tag. */
  permission?: string;
  ms?: number;
}

/** Show a transient caption (only displayed while Review mode is on). */
export function showDemoCaption(c: DemoCaption) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<DemoCaption>("vyapar-caption", { detail: c }));
}

export const PERM_MGMT = "whatsapp_business_management";
export const PERM_MSG = "whatsapp_business_messaging";
