import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-xl border px-2.5 py-0.5 text-[11px] font-bold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 select-none shadow-2xs",
  {
    variants: {
      variant: {
        default:
          "border-orange-200/80 bg-orange-50/90 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-400",
        secondary:
          "border-slate-200/80 bg-slate-100/90 text-slate-800 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-200",
        destructive:
          "border-red-200/80 bg-red-50/90 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400",
        outline: "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300",
        success:
          "border-emerald-200/80 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
