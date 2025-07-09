import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function CheckoutSuccess() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Invalidate the credits query to refresh the balance
    queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
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
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600">
              Thank you for your purchase! Your credits have been added to your account.
            </p>
            <p className="text-sm text-gray-500">
              You can now send SMS campaigns using your newly purchased credits.
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>What's next?</strong>
            </p>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• Your credit balance has been updated</li>
              <li>• Create and send SMS campaigns</li>
              <li>• Monitor your usage in the dashboard</li>
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