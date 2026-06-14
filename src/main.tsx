// Sentry must be initialized before any other import
import "./instrument";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initGlobalErrorCapture } from "./lib/logger";

initGlobalErrorCapture();

createRoot(document.getElementById("root")!).render(<App />);
