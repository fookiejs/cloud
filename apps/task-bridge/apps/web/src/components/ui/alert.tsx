import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>((rawProps, ref) =>
  React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className", "variant"]), {
      ref,
      role: "alert",
      className: cn(alertVariants({ variant: rawProps.variant }), rawProps.className),
    }),
  ),
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>((rawProps, ref) =>
  React.createElement(
    "h5",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("mb-1 font-medium leading-none tracking-tight", rawProps.className),
    }),
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  (rawProps, ref) =>
    React.createElement(
      "div",
      Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
        ref,
        className: cn("text-sm [&_p]:leading-relaxed", rawProps.className),
      }),
    ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
