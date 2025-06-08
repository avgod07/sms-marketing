import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  LayoutDashboard, 
  Users, 
  Send, 
  BarChart3, 
  Settings, 
  HelpCircle, 
  LogOut,
  MessageSquare,
  Crown
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Send },
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

  const signOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      toast({ title: "Signed out" });
      navigate("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Sign Out Failed",
        description: error.message || "Unable to sign out",
        variant: "destructive",
      });
    },
  });

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col sidebar-transition">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">TextFlow</h1>
            <p className="text-sm text-gray-500">SMS Marketing Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <div className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Account Section */}
        <div className="mt-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            ACCOUNT
          </p>
          <div className="space-y-2">
            {account.map((item) => {
              const isActive = location === item.href;
              const Icon = item.icon;

              if (item.name === "Sign Out") {
                return (
                  <button
                    key={item.name}
                    onClick={() => signOutMutation.mutate()}
                    className={cn(
                      "flex w-full items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
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
                    "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
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
        </div>
      </nav>

      {/* Pro Plan Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-primary rounded-lg p-4 text-white">
          <div className="flex items-center space-x-2 mb-2">
            <Crown className="w-5 h-5 text-yellow-300" />
            <span className="font-semibold">Pro Plan</span>
          </div>
          <p className="text-sm text-blue-100 mb-3">5,000 messages remaining</p>
          <button className="w-full bg-white text-primary font-medium py-2 px-4 rounded-md hover:bg-gray-50 transition-colors">
            Upgrade Plan
          </button>
        </div>
      </div>
    </aside>
  );
}
