import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles.css";
import { LanguageProvider } from "./shared/i18n/LanguageProvider";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </React.StrictMode>,
);
