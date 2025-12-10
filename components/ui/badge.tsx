"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

  const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
    default: "border-slate-200 bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100",
    secondary:
      "border-transparent bg-slate-900 text-slate-50 dark:bg-slate-100 dark:text-slate-900",
    outline:
      "border-slate-300 bg-transparent text-slate-700 dark:border-slate-600 dark:text-slate-200",
  };

  const variantKey: NonNullable<BadgeProps["variant"]> = variant ?? "default";

  return (
    <div className={cn(base, variants[variantKey], className)} {...props} />
  );
}
