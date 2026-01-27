"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      // Check localStorage first
      let stored: Theme | null = null;
      try {
        stored = localStorage.getItem("theme") as Theme | null;
      } catch (e) {
        // localStorage might be disabled
      }
      
      if (stored && ["light", "dark"].includes(stored)) {
        setTheme(stored);
        applyTheme(stored);
      } else {
        // Check system preference
        const isDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme = isDark ? "dark" : "light";
        setTheme(initialTheme);
        applyTheme(initialTheme);
      }
    } catch (error) {
      console.error("Error initializing theme:", error);
      setTheme("light");
    } finally {
      setMounted(true);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    try {
      const html = document.documentElement;
      if (!html) return;
      
      if (newTheme === "dark") {
        html.classList.add("dark");
      } else {
        html.classList.remove("dark");
      }
      
      try {
        localStorage.setItem("theme", newTheme);
      } catch (e) {
        // localStorage might be disabled in private mode
        console.warn("localStorage not available, theme won't persist");
      }
    } catch (error) {
      console.error("Failed to apply theme:", error);
    }
  };

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === "light" ? "dark" : "light";
      applyTheme(newTheme);
      return newTheme;
    });
  };

  if (!mounted) {
    return <>{children}</>;
  }

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
