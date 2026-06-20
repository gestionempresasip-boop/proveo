import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proveo — Gestión de restaurantes",
  description: "Gestión de productos, pedidos e inventario para grupos de restauración",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  other: {
    google: "notranslate",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased notranslate`}
      translate="no"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
