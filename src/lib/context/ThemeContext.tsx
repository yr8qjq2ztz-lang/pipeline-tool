"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";

    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored && (stored === "light" || stored === "dark")) return stored;
    } catch {
      // localStorage might be disabled
    }

    const isDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    return isDark ? "dark" : "light";
  });

  function applyTheme(newTheme: Theme) {
    try {
      // Only touch the DOM/localStorage in the browser
      if (typeof window === "undefined") return;

      const html = document.documentElement;
      if (!html) return;

      if (newTheme === "dark") {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }

      try {
        localStorage.setItem("theme", newTheme);
      } catch {
        // localStorage might be disabled in private mode
        console.warn("localStorage not available, theme won't persist");
      }
    } catch (error) {
      console.error("Failed to apply theme:", error);
    }
  }

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
