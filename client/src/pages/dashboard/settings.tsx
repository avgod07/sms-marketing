import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  Save,
  CreditCard,
  Phone,
  Crown,
  AlertCircle,
  ExternalLink,
  MessageSquareText,
} from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { useSubscription } from "@/hooks/use-subscription";
import { differenceInCalendarDays, format } from "date-fns";
import { useLocation } from "wouter";
import { formatPhoneNumber } from "@/components/ui/phone-input";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { useToast } from "@/hooks/use-toast";
import { useSetupStatus } from "@/hooks/use-setup-status";
import type { TwilioSettings } from "@shared/api-types";
import InitialMessageSettings from "@/components/InitialMessageSettings";

export default function Settings() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("account");

  // Parse tab from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const tab = urlParams.get('tab');
    if (tab && ['account', 'billing'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  // Query to get current account info (company name and email)
  const { data: accountInfo, isLoading, error } = useQuery({
    queryKey: ["/api/business/account-info"],
    queryFn: async () => {
      const res = await apiRequest({ method: "GET", url: "/api/business/account-info" });
      return res.json();
    },
  });

  // Query onboarding status
  const { data: setupStatus, isLoading: setupLoading } = useSetupStatus();
  const onboardingComplete = setupStatus?.onboardingComplete;

  const [companyName, setCompanyName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (accountInfo) {
      setCompanyName(accountInfo.companyName || "");
      setContactEmail(accountInfo.contactEmail || "");
      setIsDirty(false);
    }
  }, [accountInfo]);

  const saveMutation = useMutation({
    mutationFn: (data: { companyName: string }) =>
      apiRequest({
        method: "POST",
        url: "/api/business/account-info",
        data,
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Company name updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/business/account-info"] });
      setIsDirty(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompanyName(e.target.value);
    setIsDirty(e.target.value !== (accountInfo?.companyName || ""));
  };

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 mt-1">
              Manage your account and platform configurations.
            </p>
          </div>
        </div>
      </header>

      <div className="p-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl">
          <TabsList className="mb-4">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <SettingsIcon className="w-5 h-5" />
                    <span>Account Settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading || setupLoading ? (
                    <div className="text-gray-500">Loading...</div>
                  ) : error ? (
                    <div className="text-red-600">Error loading account info</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="company-name">Company Name</Label>
                          <Input
                            id="company-name"
                            value={onboardingComplete ? companyName : ""}
                            onChange={handleCompanyNameChange}
                            disabled={!onboardingComplete || saveMutation.isPending}
                          />
                          {!onboardingComplete && (
                            <p className="text-sm text-gray-500 mt-1">
                              Complete onboarding to set your company name.
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="contact-email">Contact Email</Label>
                          <Input
                            id="contact-email"
                            value={contactEmail}
                            readOnly
                            className="bg-gray-50"
                            placeholder="Email from your account"
                          />
                          <p className="text-sm text-gray-500 mt-1">
                            Contact email is managed through your account settings.
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => saveMutation.mutate({ companyName })}
                        disabled={
                          !onboardingComplete ||
                          !isDirty ||
                          saveMutation.isPending ||
                          !companyName.trim()
                        }
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {saveMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Initial Message Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquareText className="w-5 h-5" />
                    <span>Auto-Welcome Message</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InitialMessageSettings />
                </CardContent>
              </Card>

              {/* SMS Configuration Display (Read-only) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Phone className="w-5 h-5" />
                    <span>SMS Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="current-phone">Current Phone Number</Label>
                    <Input 
                      id="current-phone" 
                      value={accountInfo?.phoneNumber ? formatPhoneNumber(accountInfo.phoneNumber) : "No phone number assigned"} 
                      readOnly 
                      className="bg-gray-50"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      This is the phone number assigned during onboarding. Contact support if you need to change your SMS configuration.
                    </p>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

function BillingTab() {
  const { data: credits, isLoading, error } = useCredits();
  const { data: subscription } = useSubscription();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const isTrialUser = subscription?.plan === "free_trial";
  const trialEnd = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const daysLeft = trialEnd ? differenceInCalendarDays(trialEnd, new Date()) : 0;
  
  // Check if trial has actually expired (trialEndsAt is in the past)
  const isTrialExpired = trialEnd ? trialEnd < new Date() : false;
  
  // A user is considered a trial user only if they're on trial plan AND trial hasn't expired
  const isActiveTrialUser = isTrialUser && !isTrialExpired;

  const handlePurchaseCredits = async () => {
    const finalAmount = customAmount ? parseInt(customAmount) : amount;
    
    if (!finalAmount || finalAmount < 1) {
      toast({
        title: "Error",
        description: "Please select a valid amount of credits (minimum 1)",
        variant: "destructive",
      });
      return;
    }

    // Stripe requires minimum $0.50, which is 50 credits at $0.01 each
    if (finalAmount < 50) {
      toast({
        title: "Error",
        description: "Minimum purchase is 50 credits ($0.50) to meet payment processor requirements",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest({
        method: "POST",
        url: "/api/credits/checkout",
        data: {
          amount: finalAmount,
          successUrl: `${window.location.origin}/checkout-success`,
          cancelUrl: `${window.location.origin}/settings?tab=billing`,
        },
      });

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      if (err.status === 403 && err.data?.code === "UPGRADE_REQUIRED") {
        toast({
          title: "Upgrade Required",
          description: "Please upgrade to a paid plan to purchase credits.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: handleApiError(err),
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpgradePlan = async (billingCycle: "monthly" | "yearly") => {
    setIsUpgrading(true);
    try {
      const response = await apiRequest({
        method: "POST",
        url: "/api/subscriptions/checkout",
        data: {
          planName: "starter",
          billingCycle,
          successUrl: `${window.location.origin}/subscription-success`,
          cancelUrl: `${window.location.origin}/settings?tab=billing`,
        },
      });

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      console.error("Upgrade error:", err);
      toast({
        title: "Upgrade Failed",
        description: "Unable to start the upgrade process. Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleAmountSelect = (selectedAmount: number) => {
    setAmount(selectedAmount);
    setCustomAmount(""); // Clear custom amount when selecting predefined amount
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    // Clear predefined amount selection when using custom amount
    if (value) {
      setAmount(0);
    }
  };

  const getFinalAmount = () => {
    return customAmount ? parseInt(customAmount) || 0 : amount;
  };

  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      const response = await apiRequest({
        method: "POST",
        url: "/api/subscriptions/cancel",
      });
      if (!response.ok) {
        throw await response.json();
      }
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of your billing period.",
        variant: "destructive",
      });
      setShowCancelDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/current"] });
    } catch (err) {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-24 bg-gray-200 rounded-lg mb-6"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading credits: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="relative flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Current Plan</span>
          </div>
          {/* Cancel Subscription Button (only for paid users) */}
          {!isTrialUser && (
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-4 right-4 z-10"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {isTrialUser ? (
            <>
              <p className="text-gray-700 font-semibold">Free Trial</p>
              {isTrialExpired ? (
                <p className="text-sm text-red-600">
                  Your trial has expired. Please upgrade to continue using the platform.
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  {trialEnd ? `Your trial ends in ${daysLeft} days (${format(trialEnd, "MMMM d, yyyy")})` : "Your trial is active"}
                </p>
              )}
              <Button variant="outline" onClick={() => window.location.href = "/pricing"}>View Pricing & Plans</Button>
            </>
          ) : (
            <>
              <p className="text-gray-700 font-semibold">Starter Plan</p>
              <p className="text-lg font-bold">$20/month <span className="text-gray-400 font-normal">or</span> $180/year <span className="text-xs text-gray-500">(billed annually)</span></p>
              <p className="text-xs text-gray-500">Just $15/mo, billed annually</p>
              <Button variant="outline" onClick={() => window.location.href = "/pricing"}>View Pricing & Plans</Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="bg-blue-50 rounded-lg p-6 text-center">
        <p className="text-4xl font-bold text-blue-600">{credits?.balance ?? "--"}</p>
        <p className="text-gray-600 mt-1">Credits Remaining</p>
      </div>

      <Button 
        onClick={() => setOpen(true)} 
        disabled={isActiveTrialUser}
        className={isActiveTrialUser ? "opacity-50 cursor-not-allowed" : ""}
      >
        {isActiveTrialUser ? "Get More Credits (Upgrade Required)" : "Buy Credits"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Purchase additional credits to send SMS campaigns. Each credit allows you to send one SMS message.
            </p>
            <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
              <strong>Note:</strong> Minimum purchase is 50 credits ($0.50) to meet payment processor requirements.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Number of Credits</Label>
              <div className="grid grid-cols-3 gap-2">
                {[50, 100, 250].map((value) => (
                  <Button
                    key={value}
                    variant={amount === value && !customAmount ? "default" : "outline"}
                    onClick={() => handleAmountSelect(value)}
                    className="w-full"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[500, 1000].map((value) => (
                  <Button
                    key={value}
                    variant={amount === value && !customAmount ? "default" : "outline"}
                    onClick={() => handleAmountSelect(value)}
                    className="w-full"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              
              <div className="mt-3">
                <Label htmlFor="custom-amount">Or enter custom amount</Label>
                <Input
                  id="custom-amount"
                  type="number"
                  min="1"
                  placeholder="Enter number of credits"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Price:</span> ${(getFinalAmount() * 0.01).toFixed(2)} USD
              </p>
              <p className="text-xs text-gray-500 mt-1">
                $0.01 per credit
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchaseCredits}
                disabled={isSubmitting || getFinalAmount() < 50}
                className="flex-1"
              >
                {isSubmitting ? "Processing..." : "Purchase Credits"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-red-600">
              Are you sure you want to cancel your subscription? This action cannot be undone and you will lose access to paid features at the end of your billing period.
            </p>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="flex-1">
                Keep Subscription
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelSubscription}
                disabled={isCancelling}
                className="flex-1"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancel"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

