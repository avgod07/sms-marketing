import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/error-boundary";
import { ClerkProvider } from "@clerk/clerk-react";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <ClerkProvider publishableKey={publishableKey}>
      <App />
    </ClerkProvider>
  </ErrorBoundary>,
);

