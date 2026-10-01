import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import SharePageClient from "./SharePageClient";
import {
  buildSharePreviewSearchParams,
  parseSharePreviewParams,
} from "@/app/utils/sharePreviewParams";

type SharePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  searchParams,
  params: routeParams,
}: SharePageProps): Promise<Metadata> {
  const { locale } = await routeParams;
  const params = await searchParams;
  const t = await getTranslations({ locale, namespace: "Og" });
  const preview = parseSharePreviewParams(params);
  const ogQuery = buildSharePreviewSearchParams(preview).toString();
  const ogImage = `/api/og?${ogQuery}&locale=${encodeURIComponent(locale)}`;

  return {
    title: t("title", { username: preview.username }),
    description: t("description"),
    openGraph: {
      title: t("title", { username: preview.username }),
      description: t("description"),
      type: "article",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 1200,
          alt: t("shareCardAlt"),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t("title", { username: preview.username }),
      images: [ogImage],
    },
  };
}

export default function ShareCardPage() {
  return (
    <Suspense fallback={null}>
      <SharePageClient />
    </Suspense>
  );
}
