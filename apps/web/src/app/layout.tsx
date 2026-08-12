import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "AdScore",
  description:
    "Markanı araştıran, rakiplerinden öğrenen ve Meta reklamlarını senin onayınla yöneten yapay zeka platformu.",
  // TODO(launch): public lansmandan önce kaldırılacak; dev kopyası indekslenmesin
  robots: { index: false, follow: false },
};

const themeInit = `(function(){try{var t=localStorage.getItem("adscore-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className={`${inter.variable} ${instrumentSerif.variable}`}>
        {children}
      </body>
    </html>
  );
}
