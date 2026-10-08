import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyapar One — WhatsApp for your business",
  description: "Connect your WhatsApp number and talk to customers from one inbox.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
