import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
