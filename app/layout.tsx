import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./ui/reset.css";
import "./ui/globals.css";
import "./ui/style.css";
import { NotificationProvider } from "./lib/NotificationContext";
import Toast from "./ui/Toast";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });
//
// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

export const metadata: Metadata = {
  title: "SmartQueue",
  description: "COSC 4353 Group 1 Project",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark">
      <body data-new-gr-c-s-check-loaded="8.937.0" data-gr-ext-installed="">
        <NotificationProvider>
          {children}
          <Toast />
        </NotificationProvider>
      </body>
    </html>
    // <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
    //   <body>{children}</body>
    // </html>
  );
}
