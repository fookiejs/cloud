import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string | null;
  message: string;
  confirmLabel: string | null;
  cancelLabel: string | null;
};

type ConfirmContextValue = {
  confirmDestructive: (
    message: string,
    options: Omit<ConfirmOptions, "message"> | null,
  ) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: null,
    message: "",
    confirmLabel: null,
    cancelLabel: null,
  });
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirmDestructive = useCallback(
    (message: string, extra: Omit<ConfirmOptions, "message"> | null = null) => {
      return new Promise<boolean>((resolve) => {
        resolveRef.current = resolve;
        const merged: ConfirmOptions = {
          title: null,
          confirmLabel: null,
          cancelLabel: null,
          message,
        };
        if (extra !== null) {
          merged.title = extra.title;
          merged.confirmLabel = extra.confirmLabel;
          merged.cancelLabel = extra.cancelLabel;
        }
        setOptions(merged);
        setOpen(true);
      });
    },
    [],
  );

  function finish(result: boolean) {
    setOpen(false);
    const resolve = resolveRef.current;
    if (resolve !== null) {
      resolve(result);
    }
    resolveRef.current = null;
  }

  let dialogTitle = "Delete?";
  if (options.title !== null) {
    dialogTitle = options.title;
  }
  let cancelLabel = "Cancel";
  if (options.cancelLabel !== null) {
    cancelLabel = options.cancelLabel;
  }
  let confirmLabel = "Delete";
  if (options.confirmLabel !== null) {
    confirmLabel = options.confirmLabel;
  }

  return (
    <ConfirmContext.Provider value={{ confirmDestructive }}>
      {children}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) finish(false);
        }}
      >
        <DialogContent className="max-w-md border-white/[0.1] bg-[#111] sm:rounded-xl [&>button]:hidden">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{options.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => finish(false)}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="destructive" onClick={() => finish(true)}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return context;
}
