import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/15 text-success",
        warn: "border-transparent bg-warn/15 text-warn",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge(rawProps: BadgeProps) {
  return React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className", "variant"]), {
      className: cn(badgeVariants({ variant: rawProps.variant }), rawProps.className),
    }),
  );
}

export { Badge, badgeVariants };
