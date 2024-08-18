import type { Metadata } from "next";
import { Source_Code_Pro } from "next/font/google";
import "./globals.css";

const poppins = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EATRi8",
  description:
    "A web app that scans food products to provide instant insights, including a health meter, potential health concerns, recommended portion sizes, and detailed nutritional facts. It helps users make informed dietary choices quickly and easily.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="lofi">
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
