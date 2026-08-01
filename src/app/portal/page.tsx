import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { PortalProfileClient } from "@/components/portal/PortalProfileClient";

export default async function PortalHomePage() {
  const session = await getSession();
  // Any role with a linked member profile may use the portal (incl. staff).
  if (!session?.memberId) {
    redirect("/portal/login");
  }

  return <PortalProfileClient memberId={session.memberId} />;
}
