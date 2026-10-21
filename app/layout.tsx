import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BottomNav } from "@/components/app/BottomNav";
import { PwaSetup } from "@/components/app/PwaSetup";
import { Providers } from "@/components/ui/Providers";

// Fontes self-hosted (OFL) com preload e métricas de fallback ajustadas (evita layout shift)
const display = localFont({
  src: "./fonts/BricolageGrotesque.woff2",
  weight: "200 800",
  variable: "--font-bricolage",
  display: "swap",
  adjustFontFallback: "Arial",
});
const sans = localFont({
  src: "./fonts/Manrope.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: "Arial",
});

export const metadata: Metadata = {
  title: {
    default: "Kismet Score · Manoel × Ana",
    template: "%s · Kismet Score",
  },
  description: "Placar, histórico e estatísticas da disputa de Kismet entre Manoel e Ana — 3 partidas por mês.",
  robots: { index: false, follow: false },
  applicationName: "Kismet",
  appleWebApp: {
    capable: true,
    title: "Kismet",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#07060d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-svh">
        <Providers>
          {children}
          <BottomNav />
          <PwaSetup />
        </Providers>
      </body>
    </html>
  );
}
