import type { Metadata } from "next";
import { PT_Serif, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const ptSerif = PT_Serif({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MortgageDesk — CRM для ипотечных брокеров",
  description:
    "MVP CRM: ведение клиента от консультации до формирования ипотечного досье.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${ptSerif.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
