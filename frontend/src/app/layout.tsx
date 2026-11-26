import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Restaurant OS - Premium Multi-Restaurant Operating System",
  description: "Next-generation multi-tenant platform for restaurant management, POS, kitchen operations, and QR ordering.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#C76B4A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAF8F4] text-[#292B28]">
        <QueryProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            toastOptions={{
              style: {
                borderRadius: '12px',
                border: '1px solid #EAE7E0',
                fontFamily: 'var(--font-dm-sans)',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
