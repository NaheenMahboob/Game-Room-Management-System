import { withRole } from "@/lib/auth/api";
import { jsonOk, handleRouteError } from "@/lib/api/http";
import { getMemberAnnouncements } from "@/lib/services/publicBoard";

export const GET = withRole(["MEMBER"], async () => {
  try {
    const announcements = await getMemberAnnouncements();
    return jsonOk({ announcements });
  } catch (error) {
    return handleRouteError(error);
  }
});
