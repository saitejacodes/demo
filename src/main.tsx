import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.tsx";

const theme = (() => { try { return localStorage.getItem("rte-app:theme") } catch { return null } })();
if (theme && theme !== "auto") document.documentElement.setAttribute("data-theme", theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
