import type { Metadata, Viewport } from "next";
import { Poppins, Baloo_2 } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "sonner";

const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo2",
  weight: ["800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Restaurant OS - Premium Multi-Restaurant Operating System",
  description: "Creative, high-performance multi-tenant operating system for restaurants, POS, kitchen management, and customer ordering.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#B4D58A",
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
    <html lang="en" className={`${poppins.variable} ${baloo2.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-[#252525] font-poppins selection:bg-[#B4D58A] selection:text-[#252525]">
        <QueryProvider>
          {children}
          <Toaster 
            position="top-right" 
            richColors 
            toastOptions={{
              style: {
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 12px 36px rgba(60, 40, 80, 0.18)',
                fontFamily: 'var(--font-poppins)',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
