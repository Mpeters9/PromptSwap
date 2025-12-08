import React from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TEMP: No auth, no Supabase, no cookies — just render children.
  return <>{children}</>;
}
