"use client";

import { ErrorCard } from "@/components/ErrorCard";
import { useTranslations } from "next-intl";

export default function ConnectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ConnectPage.errorBoundary");
  return <ErrorCard error={error} reset={reset} title={t("title")} />;
}
