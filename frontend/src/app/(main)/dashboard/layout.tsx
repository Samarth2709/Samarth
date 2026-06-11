import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Project Dashboard — Samarth Kumbla",
  description: "Project dashboard with Git-derived metrics.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

