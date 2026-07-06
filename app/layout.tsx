import "./globals.css";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
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