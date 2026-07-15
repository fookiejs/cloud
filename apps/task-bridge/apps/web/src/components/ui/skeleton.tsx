import * as React from "react";
import { cn, omitProps, type PropBag } from "@/lib/utils";

function Skeleton(rawProps: React.HTMLAttributes<HTMLDivElement>) {
  return React.createElement(
    "div",
    Object.assign({}, omitProps(rawProps as PropBag, ["className"]), {
      className: cn("animate-pulse rounded-md bg-muted", rawProps.className),
    }),
  );
}

export { Skeleton };
