import * as React from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass rounded-xl p-5 shadow-glow transition hover:-translate-y-0.5", className)}
      {...props}
    />
  );
}
