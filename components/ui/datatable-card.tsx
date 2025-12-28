// components/ui/datatable-card.tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

const DataTableCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // base
      "rounded-2xl border bg-card text-card-foreground shadow-sm",
      // optional glassy feel (won't break normal theme)
      "backdrop-blur supports-[backdrop-filter]:bg-card/70",
      className
    )}
    {...props}
  />
));
DataTableCard.displayName = "DataTableCard";

const DataTableCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col gap-1.5 p-4 sm:p-5", className)}
    {...props}
  />
));
DataTableCardHeader.displayName = "DataTableCardHeader";

const DataTableCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-base font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DataTableCardTitle.displayName = "DataTableCardTitle";

const DataTableCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DataTableCardDescription.displayName = "DataTableCardDescription";

const DataTableCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-0", className)} {...props} />
));
DataTableCardContent.displayName = "DataTableCardContent";

const DataTableCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-4 sm:p-5", className)}
    {...props}
  />
));
DataTableCardFooter.displayName = "DataTableCardFooter";

export {
  DataTableCard,
  DataTableCardHeader,
  DataTableCardTitle,
  DataTableCardDescription,
  DataTableCardContent,
  DataTableCardFooter,
};
