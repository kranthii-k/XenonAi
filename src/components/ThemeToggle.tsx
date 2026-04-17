"use client";

import { useState, useEffect, useCallback } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setIsDark(root.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    const root = document.documentElement;
    const goingLight = root.classList.contains("dark");

    if (goingLight) {
      root.classList.remove("dark");
      root.classList.add("light");
      localStorage.setItem("xenon-theme", "light");
      setIsDark(false);
    } else {
      root.classList.remove("light");
      root.classList.add("dark");
      localStorage.setItem("xenon-theme", "dark");
      setIsDark(true);
    }
  }, []);

  if (!mounted) return <div className="w-10 h-10" />;

  return (
    <button
      onClick={toggle}
      className="relative flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-all duration-200 cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-amber-400" />
      ) : (
        <Moon className="w-5 h-5 text-indigo-600" />
      )}
    </button>
  );
}
