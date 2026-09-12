import { PublicBoardClient } from "@/components/public/PublicBoardClient";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Game Room Status Board",
  description: "Live occupancy and equipment availability",
};

/**
 * Public lobby board. When a member is already signed in, the header links
 * back to the portal instead of the login form.
 *
 * @author Muhammad Naheen Mahboob
 */
export default async function PublicBoardPage() {
  const session = await getSession();
  // Only treat linked member profiles as “signed in” for the portal CTA.
  const signedIn = Boolean(session?.memberId);

  return <PublicBoardClient signedIn={signedIn} />;
}
