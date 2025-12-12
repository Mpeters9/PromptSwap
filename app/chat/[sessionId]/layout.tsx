import { ReactNode } from "react";

export default async function ChatLayout({
  children,
}: {
  children: ReactNode;
}) {
  // TEMP: Disable server-side auth gating to avoid redirect loops while stabilizing the app.
  // const user = await getCurrentUser();
  // if (!user) {
  //   redirect("/auth/login");
  // }

  return <>{children}</>;
}
