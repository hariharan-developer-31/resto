import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition-all",
  {
    variants: {
      variant: {
        default:
          "bg-[#C2B0DC] text-white shadow-xs",
        lilac:
          "bg-[#C2B0DC] text-white shadow-xs",
        mint:
          "bg-[#B4D58A] text-[#252525] shadow-xs",
        butter:
          "bg-[#F3DA8A] text-[#252525] shadow-xs",
        pink:
          "bg-[#F2AFC0] text-white shadow-xs",
        white:
          "bg-white text-[#252525] shadow-[0_2px_10px_rgba(60,40,80,0.12)]",
        secondary:
          "bg-[#B4D58A] text-[#252525]",
        success:
          "bg-[#B4D58A] text-[#252525]",
        warning:
          "bg-[#F3DA8A] text-[#252525]",
        info:
          "bg-[#C2B0DC] text-white",
        danger:
          "bg-[#F2AFC0] text-white",
        outline:
          "border border-[#252525]/15 text-[#252525] bg-white/80",
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
