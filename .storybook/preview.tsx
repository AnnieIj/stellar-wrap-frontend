import type { Preview } from "@storybook/nextjs";
import React, { useEffect } from "react";
import "../app/globals.css";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Global theme",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "dark", title: "Dark" },
          { value: "light", title: "Light" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "dark",
  },
  parameters: {
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "error" },
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "667px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1440px", height: "900px" },
        },
      },
    },
  },
  decorators: [
    (Story, context) => {
      const { theme } = context.globals;
      useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("light", theme === "light");
        return () => root.classList.remove("light");
      }, [theme]);
      return (
        <div className="min-h-screen w-full bg-[var(--color-theme-background)] p-4 text-[var(--color-foreground)] sm-p-6 md-p-8 lg-p-10">
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
