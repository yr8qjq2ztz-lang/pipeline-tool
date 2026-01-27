import { useEffect, useCallback } from "react";

interface KeyboardShortcuts {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle Cmd/Ctrl based shortcuts
      const key = e.key.toLowerCase();
      const isMeta = e.metaKey || e.ctrlKey;

      // Single key shortcuts (like pressing 'n' alone)
      if (!isMeta && !e.shiftKey && !e.altKey && shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
        return;
      }

      // Meta key shortcuts (Ctrl/Cmd + key)
      if (isMeta && !e.shiftKey) {
        if (shortcuts[`meta+${key}`]) {
          e.preventDefault();
          shortcuts[`meta+${key}`]();
          return;
        }
      }

      // Meta + Shift shortcuts
      if (isMeta && e.shiftKey) {
        if (shortcuts[`meta+shift+${key}`]) {
          e.preventDefault();
          shortcuts[`meta+shift+${key}`]();
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
