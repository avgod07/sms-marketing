import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { useToast } from "@/hooks/use-toast";
import { useClerk } from "@clerk/clerk-react";
import { useCredits } from "@/hooks/use-credits";
import { useSetupStatus } from "@/hooks/use-setup-status";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard,
  Users,
  Send,
  Plus,
  Tag,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  MessageSquare,
  MessageSquareText,
  ListChecks,
  CreditCard,
  Hash,
} from "lucide-react";

const navigation = [
  // Create campaign is surfaced first for quick access
  { name: "Create Campaign", href: "/campaigns/new", icon: Plus },
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Keywords", href: "/keywords", icon: Hash },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Coupons", href: "/coupons", icon: Tag },
  { name: "Inbox", href: "/inbox", icon: MessageSquareText },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

const account = [
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "Help", href: "/help", icon: HelpCircle },
  { name: "Sign Out", href: "#", icon: LogOut },
];

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const { signOut } = useClerk();
  const { data: user } = useAuth();
  const { data: setup } = useSetupStatus(!!user);
  const showOnboarding =
    !!user &&
    !setup?.onboardingComplete &&
    (!setup?.phoneConfigured || !setup?.hasContacts || !setup?.hasCoupons);

  const signOutMutation = useMutation({
    mutationFn: () => signOut(),
    onSuccess: async () => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: "Signed out" });
      navigate("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Sign Out Failed",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col sidebar-transition">
      {/* Logo Section */}
      <div className="p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">NotiFlow</h1>
            <p className="text-sm text-gray-500">Messaging Made Easy</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex flex-col flex-1 p-4">
        <div className="flex-1 space-y-1.5">
          {showOnboarding && (
            <Link
              href="/onboarding"
              className={cn(
                "flex items-center space-x-3 px-4 py-[0.625rem] rounded-lg font-medium transition-colors text-[0.8125rem]",
                location === "/onboarding"
                  ? "bg-primary text-white"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <ListChecks className="w-5 h-5" />
              <span>Onboarding</span>
            </Link>
          )}
          {navigation.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-4 py-[0.625rem] rounded-lg font-medium transition-colors text-[0.8125rem]",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100",
                  item.name === "Create Campaign" && "border-b-2 border-blue-600"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Account Section */}
        <div className="mt-auto pt-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ACCOUNT
          </p>
          <div className="space-y-1.5">
            {account.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;

              if (item.name === "Sign Out") {
                return (
                  <button
                    key={item.name}
                    onClick={() => signOutMutation.mutate()}
                    className={cn(
                      "flex w-full items-center space-x-3 px-4 py-[0.625rem] rounded-lg transition-colors text-[0.8125rem]",
                      "text-gray-700 hover:bg-gray-100",
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>
                      {signOutMutation.isPending ? "Signing Out..." : item.name}
                    </span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center space-x-3 px-4 py-[0.625rem] rounded-lg transition-colors text-[0.8125rem]",
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4">
            <CreditsDisplay />
          </div>
        </div>
      </nav>

    </aside>
  );
}

function CreditsDisplay() {
  const { data: credits } = useCredits();
  return (
    <div className="w-full rounded-md bg-primary py-2 text-center text-sm font-medium text-white">
      {`Credits: ${credits?.balance ?? "--"}`}
    </div>
  );
}
