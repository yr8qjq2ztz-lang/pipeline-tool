"use client";

import { useMemo, useState } from "react";

type DemoModeBannerProps = {
  enabled: boolean;
  message?: string;
};

export default function DemoModeBanner({
  enabled,
  message = "Demo mode: data is shared. Please don’t enter real customer info.",
}: DemoModeBannerProps) {
  const storageKey = "pipelineTool_hideDemoBanner";

  const initialHidden = useMemo(() => {
    if (!enabled) return true;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [enabled]);

  const [hidden, setHidden] = useState(initialHidden);

  if (!enabled || hidden) return null;

  return (
    <div className="sticky top-0 z-50 w-full border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/60 dark:text-amber-100">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
            DEMO
          </span>
          <span className="leading-snug">{message}</span>
        </div>

        <button
          type="button"
          className="rounded-md px-2 py-1 text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/40"
          onClick={() => {
            try {
              localStorage.setItem(storageKey, "1");
            } catch {
              // ignore
            }
            setHidden(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
