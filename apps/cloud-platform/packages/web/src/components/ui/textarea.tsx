import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((rawProps, ref) =>
  React.createElement(
    "textarea",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      className: cn(
        "flex min-h-[80px] w-full rounded-xl border border-white/[0.1] bg-[#111111] px-3 py-2 text-sm text-foreground ring-offset-black placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:cursor-not-allowed disabled:opacity-50",
        rawProps.className,
      ),
      ref,
    }),
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
