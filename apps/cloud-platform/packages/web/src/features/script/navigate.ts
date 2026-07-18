let navigateImpl: ((to: string) => void) | null = null;

export function bindScriptNavigate(navigate: (to: string) => void): void {
  navigateImpl = navigate;
}

export function navigate(path: string): void {
  let p = path;
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  let target = p;
  if (p === "/" || p === "/dashboard") {
    target = "/script";
  } else if (p.startsWith("/script")) {
    target = p;
  } else if (p.startsWith("/workspace/") || p.startsWith("/task/")) {
    target = `/script${p}`;
  } else {
    target = `/script${p}`;
  }
  if (navigateImpl === null) {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new Event("script:navigate"));
    return;
  }
  navigateImpl(target);
}
