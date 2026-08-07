import type { Metadata } from "next";
import { Geist_Mono, Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700", "900"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FoundFlow - AI Found-Item Intake",
  description: "Staff-confirmed, photo-linked records for found-item teams.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${lato.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
