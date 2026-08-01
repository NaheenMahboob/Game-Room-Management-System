import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DashboardHomeClient } from "@/components/dashboard/DashboardHomeClient";

export default async function DashboardHomePage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "VOLUNTEER" && session.role !== "ADMIN")
  ) {
    redirect("/dashboard/login");
  }

  return <DashboardHomeClient />;
}
