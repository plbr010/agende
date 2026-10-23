"use client";

import type { ReactNode } from "react";
import { DemoShell } from "@/components/demo/demo-shell";

export default function DemoPanelLayout({ children }: { children: ReactNode }) {
  return <DemoShell>{children}</DemoShell>;
}
