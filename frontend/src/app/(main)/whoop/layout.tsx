import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whoop Dashboard | Samarth Kumbla",
  description: "Health and fitness metrics from Whoop - Recovery, Sleep, Strain, and Workouts",
};

export default function WhoopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

