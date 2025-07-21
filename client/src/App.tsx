import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/Campaigns";
import NewCampaignPage from "@/pages/Campaigns/New";
import Analytics from "@/pages/dashboard/analytics";
import Settings from "@/pages/dashboard/settings";
import Help from "@/pages/help";
import Coupons from "@/pages/coupons";
import OnboardingPage from "@/pages/auth/onboarding";
import Inbox from "@/pages/inbox";
import JoinPage from "@/pages/auth/join";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import CheckoutSuccess from "@/pages/checkout-success";
import SubscriptionSuccess from "@/pages/subscription-success";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useSetupStatus } from "@/hooks/use-setup-status";
import PricingPage from "@/pages/pricing";

function Router() {
  const [location, navigate] = useLocation();
  const { data: user, isLoading, isClerkAuthenticated } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus(!!user);

  const isAuthPage =
    location === "/login" ||
    location === "/signup" ||
    location.startsWith("/sign-in") ||
    location.startsWith("/sign-up");
  const isPublicPage = location.startsWith("/join/");
  const isOnboardingPage = location === "/onboarding";

  useEffect(() => {
    // Don't do anything while still loading
    if (isLoading || setupLoading) return;

    // If user is authenticated and on auth page, redirect appropriately
    if (user && isClerkAuthenticated && isAuthPage) {
      if (setupStatus && !setupStatus.onboardingComplete) {
        navigate("/onboarding");
      } else {
        navigate("/dashboard");
      }
      return;
    }

    // If user is authenticated but on onboarding page and onboarding is complete, redirect to dashboard
    if (user && isClerkAuthenticated && isOnboardingPage && setupStatus?.onboardingComplete) {
      navigate("/dashboard");
      return;
    }

    // NEW: If user is authenticated but hasn't completed onboarding, always redirect to onboarding
    if (user && isClerkAuthenticated && setupStatus && !setupStatus.onboardingComplete && !isOnboardingPage) {
      navigate("/onboarding");
      return;
    }

    // If user is not authenticated and not on auth/public pages, redirect to login
    if (!isClerkAuthenticated && !isAuthPage && !isPublicPage) {
      navigate("/login");
      return;
    }
  }, [isLoading, setupLoading, user, isClerkAuthenticated, isAuthPage, isPublicPage, isOnboardingPage, setupStatus, navigate, location]);

  // Show loading state while determining auth status
  if (isLoading || setupLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {!isAuthPage && !isPublicPage && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/join/:businessId" component={JoinPage} />
          <Route path="/checkout-success" component={CheckoutSuccess} />
          <Route path="/subscription-success" component={SubscriptionSuccess} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/campaigns/new" component={NewCampaignPage} />
          <Route path="/campaigns" component={Campaigns} />
          <Route path="/coupons" component={Coupons} />
          <Route path="/inbox" component={Inbox} />
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
