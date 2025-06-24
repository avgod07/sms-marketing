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
import OnboardingPage from "@/pages/onboarding";
import Inbox from "@/pages/inbox";
import JoinPage from "@/pages/join";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Sidebar from "@/components/layout/sidebar";
import { useUser } from "@clerk/clerk-react";

function Router() {
  const [location, navigate] = useLocation();
  const { isLoaded, user } = useUser();

  const isAuthPage =
    location === "/login" || location === "/signup";
  const isPublicPage = location.startsWith("/join/");

  useEffect(() => {
    if (isLoaded && !user && !isAuthPage && !isPublicPage) {
      navigate("/login");
    }
    if (isLoaded && user && isAuthPage) {
      navigate("/");
    }
  }, [isLoaded, user, isAuthPage, isPublicPage, navigate]);

  return (
    <div className="flex h-screen bg-gray-50">
      {!isAuthPage && !isPublicPage && <Sidebar />}
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/login" component={Login} />
          <Route path="/signup" component={Signup} />
          <Route path="/join/:businessId" component={JoinPage} />
          <Route path="/" component={Dashboard} />
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
