import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Сапер — класична гра на React",
  description:
    "Класичний Сапер на React: три рівні складності, таймер, рекорди та «акорди». Твоя перша веб-гра.",
  keywords: ["Сапер", "Сапёр", "Minesweeper", "гра", "гра онлайн", "React", "Next.js"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
