"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SelectContextValue = {
  onChange?: (value: string) => void;
  value?: string;
};

const SelectContext = React.createContext<SelectContextValue>({});

type SelectProps = {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  name?: string;
};

export function Select({ value, defaultValue, onValueChange, children, name }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? "");
  const resolvedValue = value ?? internalValue ?? "";

  const handleChange = (next: string) => {
    setInternalValue(next);
    onValueChange?.(next);
  };

  return (
    <SelectContext.Provider value={{ value: resolvedValue, onChange: handleChange }}>
      <div className="relative inline-flex w-full">
        {children}
        {name ? <input type="hidden" name={name} value={resolvedValue} /> : null}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger(
  props: React.HTMLAttributes<HTMLButtonElement>
) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-1 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900",
        props.className
      )}
    />
  );
}

export function SelectValue({
  placeholder,
  className,
}: {
  placeholder?: string;
  className?: string;
}) {
  const ctx = React.useContext(SelectContext);
  return (
    <span
      className={cn(
        "text-sm text-slate-700 dark:text-slate-100",
        !ctx.value && "text-slate-400",
        className
      )}
    >
      {ctx.value || placeholder}
    </span>
  );
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "absolute z-10 mt-1 w-full rounded-md border border-slate-200 bg-white p-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ctx = React.useContext(SelectContext);

  return (
    <button
      type="button"
      onClick={() => ctx.onChange?.(value)}
      className={cn(
        "flex w-full cursor-pointer items-center rounded-sm px-2 py-1 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800",
        className
      )}
    >
      {children}
    </button>
  );
}
