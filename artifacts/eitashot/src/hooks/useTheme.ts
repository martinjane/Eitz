import { useState, useEffect } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("eitashot-theme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("eitashot-theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("eitashot-theme", "light");
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d) };
}
