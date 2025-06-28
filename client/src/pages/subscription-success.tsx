import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft, Crown } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function SubscriptionSuccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Invalidate the subscription query to refresh the plan status
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
  }, []);

  const handleReturnToDashboard = () => {
    navigate("/dashboard");
  };

  const handleReturnToSettings = () => {
    navigate("/settings?tab=billing");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to the Starter Plan!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600">
              Thank you for upgrading! Your subscription has been activated successfully.
            </p>
            <p className="text-sm text-gray-500">
              You can now purchase additional credits and access all Starter Plan features.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Starter Plan: $20/month or $180/year
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Crown className="w-5 h-5 text-blue-600" />
              <p className="text-sm font-medium text-blue-800">Starter Plan Features</p>
            </div>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Purchase additional credits</li>
              <li>• Unlimited SMS campaigns</li>
              <li>• Basic analytics</li>
              <li>• Email support</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleReturnToDashboard}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={handleReturnToSettings}
              className="w-full"
            >
              View Billing Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 