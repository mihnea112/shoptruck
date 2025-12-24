// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ShopTruck · Piese camioane",
  description: "Webshop piese pentru camioane, B2B & B2C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ro">
      <body className={montserrat.className}>{children}</body>
    </html>
  );
}