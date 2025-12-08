"use client";

import * as React from "react";

function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

type Variant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link";

type Size = "default" | "sm" | "lg" | "icon";

function buttonVariants(opts: { variant?: Variant; size?: Size }) {
  const { variant = "default", size = "default" } = opts;

  const base =
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

  let variantClasses = "";
  switch (variant) {
    case "outline":
      variantClasses =
        "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50";
      break;
    case "secondary":
      variantClasses =
        "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200";
      break;
    case "ghost":
      variantClasses =
        "bg-transparent hover:bg-slate-100 text-slate-900 border border-transparent";
      break;
    case "destructive":
      variantClasses =
        "bg-red-600 text-white hover:bg-red-700 border border-red-700";
      break;
    case "link":
      variantClasses =
        "bg-transparent underline-offset-4 hover:underline text-blue-600 border border-transparent px-0";
      break;
    case "default":
    default:
      variantClasses = "bg-blue-600 text-white hover:bg-blue-700";
  }

  let sizeClasses = "";
  switch (size) {
    case "sm":
      sizeClasses = "h-8 px-2.5 py-1 text-xs";
      break;
    case "lg":
      sizeClasses = "h-11 px-5 py-2";
      break;
    case "icon":
      sizeClasses = "h-9 w-9";
      break;
    case "default":
    default:
      sizeClasses = "h-9 px-4 py-2";
  }

  return cn(base, variantClasses, sizeClasses);
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
