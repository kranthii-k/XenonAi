"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-9 h-9" />; // Placeholder to avoid layout shift

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors duration-300"
      aria-label="Toggle Dark Mode"
    >
      <div className="relative flex items-center justify-center w-full h-full">
        <motion.div
          initial={false}
          animate={{ scale: resolvedTheme === "dark" ? 0 : 1, opacity: resolvedTheme === "dark" ? 0 : 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="absolute"
        >
          <Sun className="w-5 h-5 text-amber-500" />
        </motion.div>
        <motion.div
          initial={false}
          animate={{ scale: resolvedTheme === "dark" ? 1 : 0, opacity: resolvedTheme === "dark" ? 1 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="absolute"
        >
          <Moon className="w-5 h-5 text-purple-400" />
        </motion.div>
      </div>
    </button>
  );
}
