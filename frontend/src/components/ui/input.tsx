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
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold uppercase tracking-wider text-[#777872]"
          >
            {label}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-[10px] border bg-white px-3.5 py-2 text-sm text-[#292B28] placeholder:text-[#A2A29A] transition-all duration-150 outline-none",
            "border-[#EAE7E0] hover:border-[#D8D4CA] focus:border-[#C76B4A] focus:ring-3 focus:ring-[#C76B4A]/10",
            error && "border-[#C84D4D] focus:border-[#C84D4D] focus:ring-[#C84D4D]/10",
            className
          )}
          ref={ref}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[#C84D4D] font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#777872]">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
