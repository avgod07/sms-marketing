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
import PrivacyPolicyPage from "@/pages/privacy";
import TermsOfServicePage from "@/pages/terms";
import Sidebar from "@/components/layout/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useTimeout } from "@/hooks/use-timeout";
import { TimeoutFallback } from "@/components/timeout-fallback";
import PricingPage from "@/pages/pricing";

function Router() {
  const [location, navigate] = useLocation();
  const { data: user, isLoading, isClerkAuthenticated } = useAuth();
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus(!!user);
  
  // iOS-aware timeout: 8 seconds for iOS, 15 seconds for others
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const timeoutDelay = isIOS ? 8000 : 15000;
  const hasTimedOut = useTimeout(timeoutDelay);

  const isAuthPage =
    location === "/login" ||
    location === "/signup" ||
    location.startsWith("/signup/") ||
    location.startsWith("/sign-in") ||
    location.startsWith("/sign-up");
  const isPublicPage = location.startsWith("/join/") || location === "/privacy" || location === "/terms";
  const isOnboardingPage = location === "/onboarding";

  useEffect(() => {
    // Don't do anything while still loading (unless timed out)
    if ((isLoading || setupLoading) && !hasTimedOut) return;

    // If user is authenticated and on auth page, redirect appropriately
    if (user && isClerkAuthenticated && isAuthPage) {
      if (setupStatus?.onboardingComplete) {
        navigate("/dashboard");
      } else {
        navigate("/onboarding");
      }
      return;
    }

    // If user is authenticated but on onboarding page and onboarding is complete, redirect to dashboard
    if (user && isClerkAuthenticated && isOnboardingPage && setupStatus?.onboardingComplete) {
      navigate("/dashboard");
      return;
    }

    // If user is not authenticated and not on auth/public pages, redirect to login
    if (!isClerkAuthenticated && !isAuthPage && !isPublicPage) {
      navigate("/login");
      return;
    }
  }, [isLoading, setupLoading, user, isClerkAuthenticated, isAuthPage, isPublicPage, isOnboardingPage, setupStatus, navigate, location, hasTimedOut]);

  // Show loading state while determining auth status (unless timed out)
  if ((isLoading || setupLoading) && !hasTimedOut) {
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
            {isIOS && (
              <p className="mt-1 text-xs text-gray-500">This may take a moment on mobile devices</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show timeout fallback if authentication has timed out and user is not authenticated
  if (hasTimedOut && !user) {
    return <TimeoutFallback />;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {!isAuthPage && !isPublicPage && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/signup/:rest*" component={Signup} />
          <Route path="/join/:businessId" component={JoinPage} />
          <Route path="/checkout-success" component={CheckoutSuccess} />
          <Route path="/subscription-success" component={SubscriptionSuccess} />
          <Route path="/privacy" component={PrivacyPolicyPage} />
          <Route path="/terms" component={TermsOfServicePage} />
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
