"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/app/context/ThemeContext";

export function GlobalToaster() {
  const { mode } = useTheme();

  return (
    <Toaster
      position="top-right"
      expand
      closeButton
      richColors
      visibleToasts={3}
      offset={16}
      theme={mode === "dark" ? "dark" : "light"}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
    />
  );
}
