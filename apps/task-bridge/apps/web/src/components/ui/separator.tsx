import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn, omitProps, type PropBag } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>((rawProps, ref) => {
  let orientation: "horizontal" | "vertical" = "horizontal";
  if (rawProps.orientation === "vertical") {
    orientation = "vertical";
  }
  let decorative = true;
  if (rawProps.decorative === false) {
    decorative = false;
  }
  let sizeClass = "h-[1px] w-full";
  if (orientation === "vertical") {
    sizeClass = "h-full w-[1px]";
  }
  return React.createElement(
    SeparatorPrimitive.Root,
    Object.assign({}, omitProps(rawProps as PropBag, ["className", "orientation", "decorative"]), {
      ref,
      decorative,
      orientation,
      className: cn("shrink-0 bg-border", sizeClass, rawProps.className),
    }),
  );
});
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
