import { useEffect, useState } from "react";

export type EditorTheme = "light" | "dark";

const STORAGE_KEY = "yaml-editor-theme";

function getSystemPreference(): EditorTheme {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function getInitialTheme(): EditorTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return getSystemPreference();
}

/**
 * Shared editor theme state backed by localStorage so that every
 * YamlEditor instance stays in sync. Falls back to the OS-level
 * `prefers-color-scheme` on first visit.
 */
export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorTheme>(getInitialTheme);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return { theme, toggleTheme };
}
