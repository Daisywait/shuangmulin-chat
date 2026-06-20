import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "双木林-chat",
  description: "A private ChatGPT-style workspace."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
