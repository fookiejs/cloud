import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>((rawProps, ref) =>
  React.createElement(
    "label",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      ref,
      className: cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", rawProps.className),
    }),
  ),
);
Label.displayName = "Label";

export { Label };
