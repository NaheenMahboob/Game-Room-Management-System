import { withAuth } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getMemberAnnouncements } from "@/lib/services/publicBoard";

/** Announcements for the member portal (any role with a linked member profile). */
export const GET = withAuth(async ({ session }) => {
  try {
    if (!session.memberId) {
      return jsonOk({ announcements: [] });
    }
    const announcements = await getMemberAnnouncements();
    return jsonOk({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
});
