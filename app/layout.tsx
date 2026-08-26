import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Playfair_Display, Monda, Poppins, Source_Serif_4, Be_Vietnam_Pro, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { RootLayoutClient } from "@/components/RootLayoutClient";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({subsets:['latin','latin-ext'],variable:'--font-sans'});
const playfair = Playfair_Display({subsets:['latin','vietnamese'],variable:'--font-playfair',style:['normal','italic']});
const monda = Monda({subsets:['latin','vietnamese'],variable:'--font-poppins',weight:['400','700']});
const poppins = Poppins({subsets:['latin','latin-ext'],variable:'--font-poppins-fallback',weight:['400','700']});
// Scoped to /tu-vi only — the "Sổ Tử Vi" ink-on-paper direction (see docs/DESIGN.md).
const sourceSerif = Source_Serif_4({subsets:['latin','vietnamese'],variable:'--font-tuvi-serif'});
const beVietnamPro = Be_Vietnam_Pro({subsets:['latin','vietnamese'],variable:'--font-tuvi-sans',weight:['400','500','600']});
const jetBrainsMono = JetBrains_Mono({subsets:['latin'],variable:'--font-tuvi-mono',weight:['400','500']});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "Notez - Personal Blog",
    template: "%s | Notez",
  },
  description: "Personal blog about code, learning notes, and daily progress.",
  keywords: "design, development, nextjs, react, typescript, ui/ux",
  authors: [{ name: "Your Name" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={cn("font-sans", geist.variable, playfair.variable, monda.variable, poppins.variable, sourceSerif.variable, beVietnamPro.variable, jetBrainsMono.variable)} data-scroll-behavior="smooth">
      <body>
        <LanguageProvider>
          <RootLayoutClient>{children}</RootLayoutClient>
        </LanguageProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
