import { AlertTriangle, CheckCircle, Clock, Phone, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function TFVStatusBanner() {
  const { data: user } = useAuth();

  // Don't show banner if user is not authenticated or TFV status is unknown
  if (!user?.tfvStatus || user.tfvStatus.status === "unknown") {
    return null;
  }

  const { tfvStatus } = user;

  // Don't show banner if already verified
  if (tfvStatus.isVerified) {
    return null;
  }

  // Don't show banner if user doesn't have phone numbers yet
  if (!tfvStatus.hasPhoneNumbers) {
    return null;
  }

  const getStatusConfig = () => {
    switch (tfvStatus.status) {
      case "pending":
        return {
          icon: Clock,
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-800",
          iconColor: "text-yellow-600",
          title: "Toll-Free Verification Pending",
          message: "Your toll-free verification is being reviewed by Twilio. This typically takes 2-5 business days.",
          action: "Messaging is restricted until verification is approved.",
        };
      case "denied":
        return {
          icon: XCircle,
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
          iconColor: "text-red-600",
          title: "Toll-Free Verification Denied",
          message: "Your toll-free verification was denied. Please contact support to resolve this issue.",
          action: "Contact support@yourapp.com for assistance.",
        };
      case "not_submitted":
        return {
          icon: AlertTriangle,
          bgColor: "bg-orange-50",
          borderColor: "border-orange-200",
          textColor: "text-orange-800",
          iconColor: "text-orange-600",
          title: "Toll-Free Verification Required",
          message: "Complete your business information to submit verification and enable messaging.",
          action: "Visit Settings → Business Profile to complete verification.",
        };
      case "no_phone_numbers":
        return {
          icon: Phone,
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
          textColor: "text-blue-800",
          iconColor: "text-blue-600",
          title: "Phone Number Required",
          message: "Purchase a toll-free number to enable messaging for your business.",
          action: "Complete onboarding to purchase your first toll-free number.",
        };
      default:
        return {
          icon: AlertTriangle,
          bgColor: "bg-gray-50",
          borderColor: "border-gray-200",
          textColor: "text-gray-800",
          iconColor: "text-gray-600",
          title: "Verification Status Unknown",
          message: "Unable to determine toll-free verification status.",
          action: "Please refresh the page or contact support if this persists.",
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`${config.bgColor} ${config.borderColor} border-l-4 p-4 mb-6`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${config.textColor}`}>
            {config.title}
          </h3>
          <div className={`mt-1 text-sm ${config.textColor} opacity-90`}>
            <p>{config.message}</p>
          </div>
          <div className={`mt-2 text-sm ${config.textColor} font-medium`}>
            <p>{config.action}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TFVStatusIndicator() {
  const { data: user } = useAuth();

  if (!user?.tfvStatus) {
    return null;
  }

  const { tfvStatus } = user;

  const getIndicatorConfig = () => {
    if (tfvStatus.isVerified) {
      return {
        icon: CheckCircle,
        color: "text-green-600",
        bgColor: "bg-green-100",
        text: "Verified",
        tooltip: "Toll-free number verified - messaging enabled",
      };
    }

    switch (tfvStatus.status) {
      case "pending":
        return {
          icon: Clock,
          color: "text-yellow-600",
          bgColor: "bg-yellow-100",
          text: "Pending",
          tooltip: "Verification pending - messaging restricted",
        };
      case "denied":
        return {
          icon: XCircle,
          color: "text-red-600",
          bgColor: "bg-red-100",
          text: "Denied",
          tooltip: "Verification denied - contact support",
        };
      case "not_submitted":
        return {
          icon: AlertTriangle,
          color: "text-orange-600",
          bgColor: "bg-orange-100",
          text: "Required",
          tooltip: "Verification required - complete business profile",
        };
      default:
        return {
          icon: AlertTriangle,
          color: "text-gray-600",
          bgColor: "bg-gray-100",
          text: "Unknown",
          tooltip: "Verification status unknown",
        };
    }
  };

  const config = getIndicatorConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`${config.bgColor} p-1 rounded-full`}
        title={config.tooltip}
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <span className={`text-sm font-medium ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
} 