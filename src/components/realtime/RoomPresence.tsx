"use client";

import { StatusPill } from "@/components/layout/StatusPill";

export function RoomPresence({ roomId }: { roomId: string }) {
  return <StatusPill tone="sage">Realtime mock · {roomId}</StatusPill>;
}
