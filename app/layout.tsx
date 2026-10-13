import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI Faculty",
    template: "%s | AI Faculty",
  },
  description: "Interactive learning with an AI teacher — 2D diagrams, 3D models, and step-by-step explanations.",
  keywords: ["AI teacher", "education", "interactive learning", "diagram", "3D model"],
  icons: {
    icon: [
      { media: "(prefers-color-scheme: light)", url: "/favicon.ico" },
      { media: "(prefers-color-scheme: dark)", url: "/favicon.ico" },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "AI Faculty",
    description: "Interactive learning with an AI teacher — 2D diagrams, 3D models, and step-by-step explanations.",
    type: "website",
  },
  category: "education",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  userScrollable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14241a" },
    { media: "(prefers-color-scheme: dark)", color: "#10141a" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
