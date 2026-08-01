"use client";

import { Suspense } from "react";
import { MembersClient } from "@/components/dashboard/MembersClient";

export default function MembersPage() {
  return (
    <Suspense fallback={<p className="text-slate-400">Loading…</p>}>
      <MembersClient />
    </Suspense>
  );
}
