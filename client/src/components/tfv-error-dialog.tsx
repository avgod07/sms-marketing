import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Settings, HelpCircle } from "lucide-react";
import { Link } from "wouter";

interface TFVErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error?: {
    message: string;
    code: string;
    guidance?: string;
    tfvStatus?: {
      status: string;
      hasPhoneNumbers: boolean;
      pendingTFVs?: Array<{ tfvSid: string; phoneNumber: string }>;
    };
    missingFields?: string[];
  };
}

export function TFVErrorDialog({ open, onOpenChange, error }: TFVErrorDialogProps) {
  if (!error) return null;

  const getErrorContent = () => {
    switch (error.code) {
      case "TFV_NOT_VERIFIED":
        return {
          icon: AlertTriangle,
          iconColor: "text-amber-600",
          title: "Messaging Restricted",
          description: error.message,
          guidance: error.guidance || "Complete toll-free verification to enable messaging.",
          actions: [
            {
              label: "View Verification Status",
              href: "/settings",
              variant: "default" as const,
            },
            {
              label: "Learn More",
              href: "/help",
              variant: "outline" as const,
            },
          ],
        };

      case "NO_PHONE_NUMBERS":
        return {
          icon: Phone,
          iconColor: "text-blue-600",
          title: "Phone Number Required",
          description: error.message,
          guidance: "Purchase a toll-free number to start sending messages.",
          actions: [
            {
              label: "Get Phone Number",
              href: "/onboarding",
              variant: "default" as const,
            },
          ],
        };

      case "INCOMPLETE_BUSINESS_INFO":
        return {
          icon: Settings,
          iconColor: "text-orange-600",
          title: "Business Information Required",
          description: error.message,
          guidance: error.guidance || "Complete your business profile to purchase toll-free numbers.",
          missingFields: error.missingFields,
          actions: [
            {
              label: "Complete Profile",
              href: "/onboarding",
              variant: "default" as const,
            },
          ],
        };

      case "INVALID_WEBSITE_URL":
        return {
          icon: Settings,
          iconColor: "text-red-600",
          title: "Invalid Website URL",
          description: error.message,
          guidance: error.guidance || "Please provide a valid business website URL.",
          actions: [
            {
              label: "Update Website",
              href: "/onboarding",
              variant: "default" as const,
            },
          ],
        };

      case "TFV_CHECK_FAILED":
      case "TFV_PRECHECK_FAILED":
        return {
          icon: HelpCircle,
          iconColor: "text-gray-600",
          title: "Verification Check Failed",
          description: error.message,
          guidance: "Please try again or contact support if the issue persists.",
          actions: [
            {
              label: "Try Again",
              onClick: () => window.location.reload(),
              variant: "default" as const,
              href: undefined,
            },
            {
              label: "Contact Support",
              href: "/help",
              variant: "outline" as const,
            },
          ],
        };

      default:
        return {
          icon: AlertTriangle,
          iconColor: "text-red-600",
          title: "Messaging Error",
          description: error.message || "An unexpected error occurred.",
          guidance: "Please try again or contact support for assistance.",
          actions: [
            {
              label: "Contact Support",
              href: "/help",
              variant: "outline" as const,
            },
          ],
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
            <div className={`p-2 rounded-full bg-gray-100`}>
              <Icon className={`h-6 w-6 ${content.iconColor}`} />
            </div>
            <DialogTitle className="text-lg font-semibold">
              {content.title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-left space-y-3">
            <p className="text-gray-700">{content.description}</p>
            
            {content.guidance && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border-l-4 border-blue-200">
                <strong>Next Steps:</strong> {content.guidance}
              </p>
            )}

            {content.missingFields && content.missingFields.length > 0 && (
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Missing Information:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-600">
                  {content.missingFields.map((field, index) => (
                    <li key={index}>{field}</li>
                  ))}
                </ul>
              </div>
            )}

            {error.tfvStatus?.pendingTFVs && error.tfvStatus.pendingTFVs.length > 0 && (
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Pending Verifications:</p>
                <div className="space-y-1">
                  {error.tfvStatus.pendingTFVs.map((tfv, index) => (
                    <div key={index} className="bg-yellow-50 p-2 rounded text-xs">
                      {tfv.phoneNumber} - Verification ID: {tfv.tfvSid.slice(-8)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {content.actions.map((action, index) => (
            <div key={index}>
              {"href" in action && action.href ? (
                <Link href={action.href}>
                  <Button
                    variant={action.variant}
                    onClick={() => onOpenChange(false)}
                    className="w-full sm:w-auto"
                  >
                    {action.label}
                  </Button>
                </Link>
              ) : (
                <Button
                  variant={action.variant}
                  onClick={() => {
                    if ("onClick" in action && action.onClick) {
                      action.onClick();
                    }
                    onOpenChange(false);
                  }}
                  className="w-full sm:w-auto"
                >
                  {action.label}
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 