import { PublicBoardClient } from "@/components/public/PublicBoardClient";

export const metadata = {
  title: "Game Room Status Board",
  description: "Live occupancy and equipment availability",
};

export default function PublicBoardPage() {
  return <PublicBoardClient />;
}
