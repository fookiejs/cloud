import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <main className="app-main flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
