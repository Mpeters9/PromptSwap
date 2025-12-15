"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Avatar({ className, ...props }: AvatarProps) {
  return (
    <div
      className={cn(
        "relative inline-flex h-10 w-10 overflow-hidden rounded-full bg-slate-200",
        className
      )}
      {...props}
    />
  );
}

export interface AvatarImageProps
  extends React.ImgHTMLAttributes<HTMLImageElement> {}

export function AvatarImage({ className, alt = "", ...props }: AvatarImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={cn("h-full w-full object-cover", className)}
      alt={alt}
      {...props}
    />
  );
}
