import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meril Daily Tracker",
  description: "Meril Life Sciences – Daily work updates and team progress tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
