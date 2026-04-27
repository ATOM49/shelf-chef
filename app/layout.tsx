import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import { DM_Sans } from "next/font/google";
import { NextAuthProvider } from "@/components/app/NextAuthProvider";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-source",
});

const fontSerif = localFont({
  src: [
    {
      path: "./fonts/georgia.woff",
      style: "normal",
      weight: "400",
    },
    {
      path: "./fonts/georgiai.woff",
      style: "italic",
      weight: "400",
    },
    {
      path: "./fonts/georgiab.woff",
      style: "normal",
      weight: "700",
    },
    {
      path: "./fonts/georgiaz.woff",
      style: "italic",
      weight: "700",
    },
  ],
  variable: "--font-serif-source",
});

const fontMono = localFont({
  src: "./fonts/Menlo-Regular.woff",
  variable: "--font-mono-source",
});

export const metadata: Metadata = {
  title: "ShelfChef – Inventory and Meal Planning",
  description:
    "Manage fridge inventory, generate a weekly dinner plan, validate ingredients, and deduct stock when meals are cooked.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={"h-full antialiased"}>
      <body
        className={`h-svh flex flex-col overflow-hidden ${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}
      >
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
