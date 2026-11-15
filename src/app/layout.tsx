import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/ui/sidebar";

export const metadata: Metadata = {
  title: "Option Journal",
  description: "Personal options trading journal and analytics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex flex-col md:flex-row min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 md:ml-64 p-4 md:p-6">{children}</main>
      </body>
    </html>
  );
}
