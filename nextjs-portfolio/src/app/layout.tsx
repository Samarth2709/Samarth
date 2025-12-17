import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ClientAnimations from "@/components/ClientAnimations";

export const metadata: Metadata = {
  title: "Samarth Kumbla",
  description: "Official site of Samarth Kumbla — U.S. foil fencer, Computer Science at Columbia University, Co-founder & CTO of Bohr Systems.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="titles-init texts-init">
        <ClientAnimations />
        <Header />
        
        <main>
          {children}
        </main>
        
        <Footer />
      </body>
    </html>
  );
}
