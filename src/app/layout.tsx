import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Сапёр — классическая игра на React",
  description:
    "Классический Сапёр на React: три сложности, таймер, рекорды и «аккорды». Твоя первая веб-игра.",
  keywords: ["Сапёр", "Minesweeper", "игра", "React", "Next.js"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
