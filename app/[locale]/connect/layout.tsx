/**
 * Connect route layout — Server Component.
 *
 * Provides metadata for the wallet connection page. This page is a
 * transient step in the wrap flow and should not appear in search results.
 */
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ConnectPage" });

  return {
    title: `${t("title")} | Stellar Wrap`,
    description: t("subtitle"),
    openGraph: {
      title: `${t("title")} | Stellar Wrap`,
      description: t("subtitle"),
      url: `/${locale}/connect`,
    },
    /** Flow pages are not landing pages — keep them out of search indexes. */
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function ConnectLayout({
  children,
}: Props) {
  return <>{children}</>;
}
