"use client";

import { useEffect, useRef, useState } from "react";

export default function LazyOnVisible({
  children,
  placeholder,
  rootMargin = "300px",
  minHeight,
}: {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: string;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (active) return;

    const el = ref.current;
    if (!el) return;

    // If IO isn't available, just render.
    if (typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [active, rootMargin]);

  return (
    <div ref={ref} style={minHeight ? { minHeight } : undefined}>
      {active ? children : placeholder ?? null}
    </div>
  );
}
