import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C2B0DC]/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#C2B0DC] text-white hover:brightness-105 shadow-[0_8px_24px_rgba(60,40,80,0.22)] uppercase tracking-wider",
        lilac:
          "bg-[#C2B0DC] text-white hover:brightness-105 shadow-[0_8px_24px_rgba(60,40,80,0.22)] uppercase tracking-wider",
        mint:
          "bg-[#B4D58A] text-[#252525] hover:brightness-105 shadow-[0_8px_24px_rgba(60,40,80,0.16)] uppercase tracking-wider",
        butter:
          "bg-[#F3DA8A] text-[#252525] hover:brightness-105 shadow-[0_8px_24px_rgba(60,40,80,0.16)] uppercase tracking-wider",
        pink:
          "bg-[#F2AFC0] text-white hover:brightness-105 shadow-[0_8px_24px_rgba(60,40,80,0.22)] uppercase tracking-wider",
        white:
          "bg-white text-[#252525] hover:bg-white/95 shadow-[0_8px_24px_rgba(60,40,80,0.16)] uppercase tracking-wider",
        secondary:
          "bg-[#B4D58A] text-[#252525] hover:brightness-105 shadow-[0_6px_20px_rgba(60,40,80,0.12)]",
        outline:
          "border border-white/60 bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all",
        outlineDark:
          "border border-[#252525]/15 bg-white/60 text-[#252525] hover:bg-white transition-all",
        ghost:
          "text-[#252525] hover:bg-black/5",
        ghostWhite:
          "text-white hover:bg-white/10",
        subtle:
          "bg-[#C2B0DC]/20 text-[#252525] hover:bg-[#C2B0DC]/30",
        danger:
          "bg-[#F2AFC0] text-white hover:brightness-95 shadow-[0_6px_20px_rgba(242,175,192,0.4)]",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-xl px-3.5 text-xs font-medium",
        lg: "h-14 rounded-2xl px-8 text-base font-bold tracking-wider",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
