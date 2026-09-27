import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { routing } from "../../i18n/routing";
import { ReactNode } from "react";
import { ThemeProvider } from "../context/ThemeContext";
import { SkipNavigation } from "@/app/components/SkipNavigation";
import { GlobalToaster } from "@/app/components/GlobalToaster";
import { Footer } from "@/app/components/Footer";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  return (
    <html lang={locale}>
      <head>
        {plausibleDomain && (
          <Script
            strategy="afterInteractive"
            data-domain={plausibleDomain}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body>
        <SkipNavigation />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {" "}
            {/* <-- Wrap here so everything inside has access to useTheme */}
            <GlobalToaster />
            {children}
            <Footer />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
