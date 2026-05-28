"use client";

import { useEffect, useState, useTransition } from "react";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { saveThemePreferenceAction } from "@/app/actions/theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = mounted && theme ? theme : "dark";
  const isDark = activeTheme === "dark";

  const handleToggle = () => {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    startTransition(() => {
      void saveThemePreferenceAction(nextTheme);
    });
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-9 w-9 rounded-md border-white/10 bg-white/5 text-header hover:bg-white/10 hover:text-header"
      onClick={handleToggle}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
