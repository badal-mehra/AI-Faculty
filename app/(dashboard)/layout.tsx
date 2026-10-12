import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import DashboardSidebar from "./DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="dashboard-layout">
      <DashboardSidebar user={user} />
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1>AI Faculty</h1>
        </header>
        <div className="dashboard-content">{children}</div>
      </main>
    </div>
  );
}