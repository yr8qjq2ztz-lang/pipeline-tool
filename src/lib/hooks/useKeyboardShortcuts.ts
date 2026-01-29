import { useEffect } from "react";

const devError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") console.error(...args);
};

interface KeyboardShortcuts {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts) {
  useEffect(() => {
    if (!shortcuts || Object.keys(shortcuts).length === 0) {
      return; // Early return if no shortcuts defined
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs or contenteditable
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.contentEditable === "true"
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

    try {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    } catch (error) {
      devError("Failed to attach keyboard shortcut listener:", error);
      return undefined;
    }
  }, [shortcuts]);
}
