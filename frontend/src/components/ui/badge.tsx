import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[#F8EAE3] text-[#AE593B] border border-[#F2DFD6]",
        secondary:
          "bg-[#EEF1E9] text-[#66745B] border border-[#E0E5DA]",
        success:
          "bg-[#EBF5EF] text-[#39845C] border border-[#D5EAD9]",
        warning:
          "bg-[#FBF5EA] text-[#D69A3A] border border-[#F5E6CC]",
        info:
          "bg-[#EBF3FC] text-[#5185B8] border border-[#CFE2F7]",
        danger:
          "bg-[#FDF0F0] text-[#C84D4D] border border-[#F8DADA]",
        outline:
          "border border-[#EAE7E0] text-[#777872] bg-white",
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
