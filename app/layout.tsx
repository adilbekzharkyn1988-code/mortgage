import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

// Один шрифт на весь интерфейс — иерархия строится весами, а не сменой
// гарнитуры. Все три CSS-переменные указывают на Inter: это сохраняет
// совместимость с существующими классами font-display/font-body/font-data
// в остальных страницах без переписывания каждого компонента.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
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
      <body className={`${inter.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
