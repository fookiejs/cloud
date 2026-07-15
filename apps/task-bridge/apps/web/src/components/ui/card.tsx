import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((rawProps, ref) =>
  React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("panel-card text-card-foreground", rawProps.className),
    }),
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((rawProps, ref) =>
  React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("flex flex-col space-y-1.5 p-5", rawProps.className),
    }),
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>((rawProps, ref) =>
  React.createElement(
    "h3",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("text-lg font-semibold leading-none tracking-tight", rawProps.className),
    }),
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  (rawProps, ref) =>
    React.createElement(
      "p",
      Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
        ref,
        className: cn("text-sm text-muted-foreground", rawProps.className),
      }),
    ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((rawProps, ref) =>
  React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("p-5 pt-0", rawProps.className),
    }),
  ),
);
CardContent.displayName = "CardContent";

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
