import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, label, helperText, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-2">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#5A5D58]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-12 w-full rounded-2xl border bg-white/90 backdrop-blur-sm px-4 py-3 text-sm text-[#252525] placeholder:text-[#8E928B] transition-all duration-200 outline-none",
            "border-black/[0.08] hover:border-[#C2B0DC] focus:border-[#C2B0DC] focus:ring-4 focus:ring-[#C2B0DC]/20",
            error && "border-[#F2AFC0] focus:border-[#F2AFC0] focus:ring-[#F2AFC0]/30",
            className
          )}
          ref={ref}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[#252525] bg-[#F2AFC0]/30 px-3 py-1 rounded-lg font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#5A5D58]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
