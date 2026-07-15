import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-white/[0.1] bg-[#111111] hover:bg-white/[0.05] hover:text-foreground",
        secondary: "bg-[#161616] text-secondary-foreground hover:bg-[#1c1c1c]",
        ghost: "hover:bg-white/[0.06] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild: boolean | null;
}

const Button = React.forwardRef<HTMLButtonElement, Partial<ButtonProps> & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (rawProps, ref) => {
    let asChild = false;
    if ("asChild" in rawProps && rawProps.asChild === true) {
      asChild = true;
    }
    const Comp = asChild ? Slot : "button";
    return React.createElement(
      Comp,
      Object.assign({}, omitProps(rawProps as PropBag, ["className", "variant", "size", "asChild"]), {
        ref,
        className: cn(buttonVariants({ variant: rawProps.variant, size: rawProps.size, className: rawProps.className })),
      }),
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
