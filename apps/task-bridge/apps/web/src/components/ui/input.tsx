import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>((rawProps, ref) =>
  React.createElement(
    "input",
    Object.assign({}, omitProps(rawProps as PropBag, ["className", "type"]), {
      type: rawProps.type,
      className: cn(
        "flex h-10 w-full rounded-xl border border-white/[0.1] bg-[#111111] px-3 py-2 text-sm text-foreground ring-offset-black file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
        rawProps.className,
      ),
      ref,
    }),
  ),
);
Input.displayName = "Input";

export { Input };
