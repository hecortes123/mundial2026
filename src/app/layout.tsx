import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Polla Mundial 2026",
  description: "Polla de pronósticos para el Mundial FIFA 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}