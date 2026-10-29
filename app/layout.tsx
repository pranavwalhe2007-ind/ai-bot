import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntelliBot AI",
  description: "A conversational AI assistant for general-purpose questions, coding help, and productivity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
