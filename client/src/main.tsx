import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/error-boundary";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const frontendApi = import.meta.env.VITE_CLERK_FRONTEND_API;
const providerProps = frontendApi
  ? { frontendApi }
  : { publishableKey };

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ClerkProvider {...providerProps}>
      <App />
    </ClerkProvider>
  </ErrorBoundary>,
);

