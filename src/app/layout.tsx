import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daraz Operations Management System (DOMS)",
  description: "Enterprise Operations & Logistics Management Platform for Daraz Hubs and Fulfillment Centers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full font-sans antialiased text-slate-900">
        {children}
      </body>
    </html>
  );
}
