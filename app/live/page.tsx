import type { Metadata } from "next";
import { LiveWall } from "@/components/LiveWall";

export const metadata: Metadata = {
  title: "Live wall",
  description: "Every bot that claimed a badge tonight.",
};

export default function LivePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-16 sm:pt-12">
      <LiveWall />
    </div>
  );
}
