import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "Cotizapp",
  description: "Cotizaciones profesionales en minutos para autonomos y pymes.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/cotizapp-icon.png",
    apple: "/icons/cotizapp-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cotizapp",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${interTight.variable} ${jetBrainsMono.variable}`}>
        <ClerkProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            themes={["light", "dark"]}
            storageKey="cotizapp-theme"
            enableSystem={false}
            disableTransitionOnChange
          >
            <ToastProvider>{children}</ToastProvider>
            <ServiceWorkerRegister />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
