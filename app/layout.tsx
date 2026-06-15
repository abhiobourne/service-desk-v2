import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../providers/AuthProvider";
import { AbilityProvider } from "../providers/AbilityProvider";
import { ThemeProvider } from "../providers/ThemeProvider";
import { NotificationProvider } from "../providers/NotificationProvider";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Quarkcity Medtech Service Desk",
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
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-[#06070a] text-[#f1f5f9]">
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <AbilityProvider>
                {children}
              </AbilityProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="top-right" gutter={8} />
      </body>
    </html>
  );
}
