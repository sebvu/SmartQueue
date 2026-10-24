import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./ui/reset.css";
import "./ui/globals.css";
import "./ui/style.css";
import { NotificationProvider } from "./lib/NotificationContext";
import { QueueProvider } from "./lib/QueueContext";
import Toast from "./ui/Toast";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SmartQueue",
  description: "COSC 4353 Group 1 Project",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.className}`} data-theme="dark">
      <body data-new-gr-c-s-check-loaded="8.937.0" data-gr-ext-installed="">
        <NotificationProvider>
          <QueueProvider>{children}</QueueProvider>
          <Toast />
        </NotificationProvider>
      </body>
    </html>
  );
}
