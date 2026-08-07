import type { Metadata } from "next";
import { Geist_Mono, Lato } from "next/font/google";
import "./globals.css";
import { isAuthDisabled } from "@/lib/auth-tokens";
import { connection } from "next/server";

const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700", "900"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FoundFlow - AI Found-Item Intake",
  description: "Staff-confirmed, photo-linked records for found-item teams.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const authDisabled = isAuthDisabled();
  return (
    <html lang="en" className={`${lato.variable} ${geistMono.variable}`}>
      <body>
        {authDisabled && (
          <div className="demo-mode-banner" role="status">
            Temporary demo mode: login is disabled{process.env.DEMO_AI_SCAN_ENABLED === "true" ? "." : ", and live AI scanning is unavailable."} Use synthetic data only; non-demo records are inaccessible.
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
