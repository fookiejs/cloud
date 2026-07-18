import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

const Select = React.forwardRef<HTMLSelectElement, SelectProps>((rawProps, ref) =>
  React.createElement(
    "select",
    Object.assign({}, omitProps(rawProps as PropBag, ["className", "style"]), {
      className: cn(
        "flex h-10 w-full rounded-xl border border-white/[0.1] bg-[#111111] px-3 py-2 text-sm text-foreground ring-offset-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
        rawProps.className,
      ),
      style: rawProps.style,
      ref,
    }),
  ),
);
Select.displayName = "Select";

export { Select };
