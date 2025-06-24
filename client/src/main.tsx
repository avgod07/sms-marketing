import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/error-boundary";
import "./index.css";
import { ClerkProvider } from "@clerk/clerk-react";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkFrontendApi = import.meta.env.VITE_CLERK_FRONTEND_API;

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={clerkPubKey} frontendApi={clerkFrontendApi}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ClerkProvider>,
);
