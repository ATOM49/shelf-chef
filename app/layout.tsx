import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Analytics } from '@vercel/analytics/next';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Food Planner – Inventory and Meal Planning",
  description: "Manage fridge inventory, generate a weekly dinner plan, validate ingredients, and deduct stock when meals are cooked.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans", geist.variable)}>
      <body className="h-full flex flex-col overflow-hidden">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
