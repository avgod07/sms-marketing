import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  LayoutDashboard,
  Users,
  Send,
  Ticket,
  BarChart3,
  Settings,
  HelpCircle,
  LogOut,
  MessageSquare
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contacts", href: "/contacts", icon: Users },
  { name: "Campaigns", href: "/campaigns", icon: Send },
  { name: "Coupons", href: "/coupons", icon: Ticket },
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
    mutationFn: () => apiRequest({ method: "POST", url: "/api/logout" }),
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

    </aside>
  );
}
