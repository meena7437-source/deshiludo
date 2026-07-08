import "./globals.css";
import { Toaster } from "react-hot-toast";
import type { Metadata, Viewport } from "next";
import PWARegister from "./PWARegister";

export const metadata: Metadata = {
  title: "DeshiLudo",
  description: "Play Ludo Battles and Win Real Cash",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#facc15",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PWARegister />
        {children}

        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#18181b",
              color: "#fff",
              border: "1px solid #facc15",
            },
          }}
        />
      </body>
    </html>
  );
}