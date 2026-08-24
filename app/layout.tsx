import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

/**
 * Inter — универсальный шрифт для всех типов текста.
 * Веса оптимизированы для UX/UI:
 * - 400: основной текст, вторичная информация
 * - 500: акценты, labels, вторичные заголовки
 * - 600: выделение, подзаголовки, важные элементы
 * - 700: основные заголовки, акценты
 */
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
