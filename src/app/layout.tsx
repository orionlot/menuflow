import type { Metadata } from "next";
import {
  Fraunces,
  Hanken_Grotesk,
  Playfair_Display,
  Space_Grotesk,
  Baloo_2,
} from "next/font/google";
import "./globals.css";

// Default display: characterful soft serif (great for hospitality / menus).
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

// Default body / UI: clean humanist grotesque.
const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Alternative menu typographies, selected per-tenant via `layout.font`
// (see FONT_VARS in src/lib/config/layout.ts).
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "MenuFlow",
  description: "Menu digitali e ordini per ristoranti e bar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${display.variable} ${body.variable} ${playfair.variable} ${spaceGrotesk.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
