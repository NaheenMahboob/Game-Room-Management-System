import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PortalProfileClient } from "@/components/portal/PortalProfileClient";

export default async function PortalHomePage() {
  const session = await getSession();
  if (!session || session.role !== "MEMBER" || !session.memberId) {
    redirect("/portal/login");
  }

  return <PortalProfileClient memberId={session.memberId} />;
}
