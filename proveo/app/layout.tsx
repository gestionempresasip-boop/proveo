import type { Metadata, Viewport } from "next";
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
  // La app es privada: que Google y compañía no la indexen
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true, nosnippet: true },
  },
  other: {
    google: "notranslate",
  },
};

// Antes iba dentro de «metadata» y Next lo ignoraba (avisaba en la consola). Mismo comportamiento que ya tenía.
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

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
