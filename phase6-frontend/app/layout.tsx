import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARGUS // Tactical Cyber Intelligence & Defense Center",
  description: "High-assurance VPN assessment & machine learning attack forecasting system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
        {children}
      </body>
    </html>
  );
}
