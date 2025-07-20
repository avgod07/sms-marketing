import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertTriangle, Clock, Zap } from "lucide-react";
import { Link } from "wouter";

interface SubscriptionErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: {
    message: string;
    code: string;
    guidance?: string;
    currentPlan?: string;
    trialUsed?: boolean;
    upgradeUrl?: string;
  };
}

export function SubscriptionErrorDialog({ open, onOpenChange, error }: SubscriptionErrorDialogProps) {
  if (!error) return null;

  type ActionItem = 
    | { label: string; href: string; variant: "default" | "outline" }
    | { label: string; onClick: () => void; variant: "default" | "outline" };

  const getErrorContent = () => {
    switch (error.code) {
      case "SUBSCRIPTION_REQUIRED":
        // Differentiate between cancelled and trial expired
        if (error.currentPlan === "cancelled") {
          return {
            icon: CreditCard,
            iconColor: "text-blue-600",
            title: "Subscription Required",
            description: "Your subscription has been cancelled. Reactivate to continue sending messages.",
            guidance: error.guidance || "Upgrade to a paid plan to resume messaging.",
            actions: [
              {
                label: "Reactivate Subscription",
                href: "/pricing",
                variant: "default" as const,
              },
              {
                label: "View Pricing",
                href: "/pricing",
                variant: "outline" as const,
              },
            ] as ActionItem[],
          };
        } else if (error.currentPlan === "free_trial" && error.trialUsed) {
          return {
            icon: Zap,
            iconColor: "text-amber-600",
            title: "Free Trial Ended",
            description: "Your free trial has ended. Upgrade to continue unlimited messaging.",
            guidance: error.guidance || "Upgrade to a paid plan to continue sending unlimited messages.",
            actions: [
              {
                label: "Upgrade Now",
                href: "/pricing",
                variant: "default" as const,
              },
              {
                label: "View Plans",
                href: "/pricing",
                variant: "outline" as const,
              },
            ] as ActionItem[],
          };
        } else {
          return {
            icon: AlertTriangle,
            iconColor: "text-orange-600",
            title: "Active Subscription Required",
            description: error.message,
            guidance: error.guidance || "Please upgrade to continue sending messages.",
            actions: [
              {
                label: "Upgrade Now",
                href: error.upgradeUrl || "/pricing",
                variant: "default" as const,
              },
            ] as ActionItem[],
          };
        }

      case "SUBSCRIPTION_CHECK_FAILED":
        return {
          icon: Clock,
          iconColor: "text-gray-600",
          title: "Unable to Verify Subscription",
          description: error.message,
          guidance: "Please try again in a moment. If the issue persists, contact support.",
          actions: [
            {
              label: "Try Again",
              onClick: () => {
                onOpenChange(false);
                // Optionally trigger a refresh or retry
                window.location.reload();
              },
              variant: "default" as const,
            },
            {
              label: "Contact Support",
              href: "/help",
              variant: "outline" as const,
            },
          ] as ActionItem[],
        };

      default:
        return {
          icon: AlertTriangle,
          iconColor: "text-red-600",
          title: "Subscription Error",
          description: error.message || "An unexpected subscription error occurred.",
          guidance: error.guidance || "Please try again or contact support for assistance.",
          actions: [
            {
              label: "Contact Support",
              href: "/help",
              variant: "outline" as const,
            },
          ] as ActionItem[],
        };
    }
  };

  const content = getErrorContent();
  const Icon = content.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-3 rounded-full bg-gray-100">
              <Icon className={`h-6 w-6 ${content.iconColor}`} />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                {content.title}
              </DialogTitle>
              <DialogDescription className="text-gray-600 mt-1">
                {content.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {content.guidance}
          </p>
          
          {/* Show current plan info if available */}
          {error.currentPlan && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 font-medium">Current Plan</p>
              <p className="text-sm capitalize font-medium">
                {error.currentPlan.replace('_', ' ')}
                {error.trialUsed && error.currentPlan === "free_trial" && (
                  <span className="text-amber-600 ml-1">(Expired)</span>
                )}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          
          {content.actions.map((action, index) => (
            "href" in action ? (
              <Link key={index} href={action.href}>
                <Button 
                  variant={action.variant}
                  onClick={() => onOpenChange(false)}
                >
                  {action.label}
                </Button>
              </Link>
            ) : (
              <Button
                key={index}
                variant={action.variant}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            )
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 