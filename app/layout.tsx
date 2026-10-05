import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Faculty | Digital Teaching Board",
  description: "Interactive digital classroom board",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
