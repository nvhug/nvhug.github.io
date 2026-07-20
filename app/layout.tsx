import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist, Playfair_Display, Monda } from "next/font/google";
import { cn } from "@/lib/utils";
import { RootLayoutClient } from "@/components/RootLayoutClient";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geist = Geist({subsets:['latin','latin-ext'],variable:'--font-sans'});
const playfair = Playfair_Display({subsets:['latin','vietnamese'],variable:'--font-playfair',style:['normal','italic']});
const monda = Monda({subsets:['latin','vietnamese'],variable:'--font-poppins',weight:['400','700']});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "nvhug - Personal Blog",
    template: "%s | nvhug",
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
    <html lang="en" className={cn("font-sans", geist.variable, playfair.variable, monda.variable)} data-scroll-behavior="smooth">
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
