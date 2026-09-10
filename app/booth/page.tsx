import type { Metadata } from "next";
import { BoothDashboard } from "@/components/BoothDashboard";
import { baseUrl, boothToken } from "@/lib/config";

export const metadata: Metadata = {
  title: "Booth ops",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function BoothPage() {
  // Only prefill when the queue is protected by the (public) party token.
  // If ADMIN_TOKEN is set, the host types it once; it's remembered in localStorage.
  const prefillToken = process.env.ADMIN_TOKEN?.trim() ? "" : boothToken();
  return <BoothDashboard prefillToken={prefillToken} claimUrl={`${baseUrl()}/claim`} />;
}
