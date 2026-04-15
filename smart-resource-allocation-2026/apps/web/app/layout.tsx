import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Resource Allocation",
  description: "Data-driven volunteer coordination for social impact",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
