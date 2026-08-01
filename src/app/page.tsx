/**
 * Home landing page: open/closed status from operating hours plus portal links.
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
  let hoursError: string | null = null;

  try {
    openingHours = await getOpeningHours();
  } catch (error) {
    hoursError =
      error instanceof Error ? error.message : "Could not load opening hours";
  }

  const status = getOpenClosedStatus(openingHours);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
      <HomeLinks
        isOpen={status.isOpen}
        dayKey={status.dayKey}
        todayHours={status.today}
        openingHours={openingHours}
        hoursError={hoursError}
      />
    </main>
  );
}
