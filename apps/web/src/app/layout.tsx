import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { CartProvider } from "@/lib/cart-context";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THE CLOVER | Premium Sportswear",
  description:
    "Premium gym sportswear and athleisure — performance gear for training and everyday movement.",
  icons: { icon: "/assets/logo-icon.png", apple: "/assets/logo-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#f4f4f5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiOrigin = process.env.NEXT_PUBLIC_API_URL;

  return (
    <html lang="en">
      <head>{apiOrigin ? <link rel="dns-prefetch" href={apiOrigin} /> : null}</head>
      <body className={`${inter.variable} font-sans min-h-screen flex flex-col overflow-x-hidden`}>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<div className="nav-spacer" aria-hidden />}>
              <Header />
            </Suspense>
            <main className="flex-1 w-full min-w-0 overflow-x-hidden">{children}</main>
            <Footer />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
