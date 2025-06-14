import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/Campaigns";
import NewCampaignPage from "@/pages/Campaigns/New";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import Coupons from "@/pages/coupons";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import OnboardingPage from "@/pages/onboarding";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useSetupStatus } from "@/hooks/use-setup-status";

function Router() {
  const [location, navigate] = useLocation();
  const { data: user, isLoading } = useAuth();
  const { data: setup, isLoading: setupLoading } = useSetupStatus(!!user);

  const isAuthPage = location === "/login" || location === "/signup";
  const isOnboardingPage = location.startsWith("/onboarding");
  const onboardingDone = localStorage.getItem("onboardingComplete") === "true";
  const needsOnboarding =
    user && !onboardingDone &&
    setup && (!setup.phoneConfigured || !setup.hasContacts);

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) {
      navigate("/login");
    }
    if (!isLoading && !setupLoading && user) {
      if (needsOnboarding) {
        if (!isOnboardingPage) navigate("/onboarding");
      } else {
        if (isAuthPage || isOnboardingPage) navigate("/");
      }
    }
  }, [isLoading, setupLoading, user, needsOnboarding, isAuthPage, isOnboardingPage, navigate]);

  return (
    <div className="flex h-screen bg-gray-50">
      {!isAuthPage && !isOnboardingPage && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/" component={Dashboard} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/campaigns/new" component={NewCampaignPage} />
          <Route path="/campaigns" component={Campaigns} />
          <Route path="/coupons" component={Coupons} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/settings" component={Settings} />
          <Route path="/help" component={Help} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
