import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResQ - Emergency Response",
  description: "AI Emergency Response for Disabled Individuals",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}