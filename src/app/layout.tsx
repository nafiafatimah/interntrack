
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InternTrack | Internship Attendance",
  description:
    "Internship Attendance Management System - Manage attendance and daily activities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
