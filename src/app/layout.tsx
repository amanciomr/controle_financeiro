import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ServiceWorker } from "@/components/service-worker";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Finanças Amâncio", template: "%s · Finanças Amâncio" },
  description: "Controle financeiro da casa: quanto dá para gastar hoje e onde o mês vai fechar.",
  applicationName: "Finanças Amâncio",
  appleWebApp: { capable: true, title: "Finanças", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

// Aplica o tema antes da primeira pintura (evita "piscar" claro → escuro).
const themeScript = `(() => {
  try {
    const t = localStorage.getItem("tema");
    const dark = t === "escuro" || (t !== "claro" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <Script id="tema" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
