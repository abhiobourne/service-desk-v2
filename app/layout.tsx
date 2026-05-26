import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../providers/AuthProvider";
import { AbilityProvider } from "../providers/AbilityProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Industrial OS - Next-Gen Operations Cockpit",
  description: "Enterprise Digital Twin and Support Management Cockpit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#06070a] text-[#f1f5f9]">
        <AuthProvider>
          <AbilityProvider>
            {children}
          </AbilityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
