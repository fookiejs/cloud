import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ConfirmDialogProvider } from "@/components/ConfirmDialogProvider";
import { App } from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement !== null) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter basename="/app">
        <ConfirmDialogProvider>
          <App />
          <Toaster richColors closeButton position="top-right" />
        </ConfirmDialogProvider>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
