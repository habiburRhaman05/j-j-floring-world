import type { Metadata, Viewport } from "next";
import { Caveat, Libre_Baskerville, Manrope } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";

/* Tailwind + the central theme map first, then the design system, so the
   tokens and component rules always win over preflight. */
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/layout.css";

/**
 * Manrope is the product UI face, the same sans the live site uses. Libre
 * Baskerville is kept for the sign-in brand moment and Caveat for the
 * e-signature only. Loading them through next/font means no render-blocking
 * Google Fonts request, and the family names reach the CSS as variables
 * rather than being hard-coded in the token file.
 */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "J&J Flooring World",
    template: "%s | J&J Flooring World",
  },
  description: "Estimator, invoicing and job dashboard for J&J Flooring World.",
  icons: { icon: "/jj-mascot.webp" },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${libreBaskerville.variable} ${caveat.variable}`}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
