import type { Metadata } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-scoreboard",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`);
  return {
    metadataBase,
    title: "Bulldogs Golf Day",
    description: "Live scoring, on-course fundraising, photos and clubhouse views for Denver Bulldogs Golf Day.",
    openGraph: {
      title: "Bulldogs Golf Day",
      description: "Live scoring, shop, photos and clubhouse views.",
      type: "website",
      images: [{ url: "/og-v2.png", width: 1734, height: 907, alt: "Denver Bulldogs Golf Day app" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Bulldogs Golf Day",
      description: "Live scoring, shop, photos and clubhouse views.",
      images: ["/og-v2.png"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${barlowCondensed.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
