"use client";

import { useEffect, useState, useTransition } from "react";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { saveThemePreferenceAction } from "@/app/actions/theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

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
      className="rounded-[1rem] border-token bg-background/80 text-foreground hover:bg-background hover:text-foreground"
      onClick={handleToggle}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}
