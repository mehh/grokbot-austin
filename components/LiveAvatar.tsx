"use client";

import { useEffect, useState } from "react";
import type { BotState } from "@/lib/avatar";
import { Avatar, stateForStatus } from "./Avatar";

export const STATUS_EVENT = "gb:status";

/** Avatar that follows the badge's live print status (broadcast by <PrintStatus/>). */
export function LiveAvatar({
  botName,
  personName,
  size,
  className,
  initialStatus,
}: {
  botName: string;
  personName: string;
  size?: number;
  className?: string;
  initialStatus?: string;
}) {
  const [state, setState] = useState<BotState>(stateForStatus(initialStatus ?? "loading"));

  useEffect(() => {
    const onStatus = (e: Event) => setState(stateForStatus((e as CustomEvent<string>).detail));
    window.addEventListener(STATUS_EVENT, onStatus);
    return () => window.removeEventListener(STATUS_EVENT, onStatus);
  }, []);

  return <Avatar botName={botName} personName={personName} size={size} className={className} state={state} />;
}
