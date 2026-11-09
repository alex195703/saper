import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Сапер — класична гра професора Орлова О.В.",
  authors: [{ name: "професор Орлов О.В." }],
  description:
    "Класичний Сапер на React: три рівні складності, таймер, рекорди та «акорди». Твоя перша веб-гра. Автор — професор Орлов О.В.",
  keywords: ["Сапер", "Сапёр", "Minesweeper", "гра", "гра онлайн", "React", "Next.js", "Орлов", "професор Орлов"],
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
