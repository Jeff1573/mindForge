// src/button.tsx
import * as React from "react";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { jsx } from "react/jsx-runtime";
function cn(...classes) {
  return twMerge(clsx(classes));
}
var buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-9 px-4 py-2",
  {
    variants: {
      variant: {
        default: "bg-black text-white hover:bg-black/90",
        outline: "border border-input bg-transparent hover:bg-neutral-100",
        ghost: "hover:bg-neutral-100"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-8"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
var Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => /* @__PURE__ */ jsx("button", { ref, className: cn(buttonVariants({ variant, size, className })), ...props })
);
Button.displayName = "Button";
export {
  Button
};
