let navigateImpl: ((to: string) => void) | null = null;
let navigateBase = "/script";

export function bindScriptNavigate(navigate: (to: string) => void, basePath = "/script"): void {
  navigateImpl = navigate;
  navigateBase = basePath;
}

export function navigate(path: string): void {
  let p = path;
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  let target = p;
  if (p === "/" || p === "/dashboard") {
    target = navigateBase;
  } else if (p.startsWith("/script")) {
    target = p;
  } else if (p.startsWith("/workspace/") || p.startsWith("/task/")) {
    target = `${navigateBase}${p}`;
  } else {
    target = `${navigateBase}${p}`;
  }
  if (navigateImpl === null) {
    window.history.pushState({}, "", target);
    window.dispatchEvent(new Event("script:navigate"));
    return;
  }
  navigateImpl(target);
}
