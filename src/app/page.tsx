/**
 * Home landing page: open/closed status from operating hours plus portal links.
 * When the database is unreachable, only a generic hours-unavailable message is shown.
 */

import {
  getOpeningHours,
  getOpenClosedStatus,
  type OpeningHoursMap,
} from "@/lib/settings";
import { HomeLinks } from "@/components/home/HomeLinks";

export const dynamic = "force-dynamic";

export default async function Home() {
  let openingHours: OpeningHoursMap | null = null;
  // Do not expose connection/driver error text on the public home page.
  let hoursUnavailable = false;

  try {
    openingHours = await getOpeningHours();
  } catch {
    hoursUnavailable = true;
  }

  const status = getOpenClosedStatus(openingHours);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
      <HomeLinks
        isOpen={status.isOpen}
        dayKey={status.dayKey}
        todayHours={status.today}
        openingHours={openingHours}
        hoursUnavailable={hoursUnavailable}
      />
    </main>
  );
}
