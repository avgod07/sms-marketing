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
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { differenceInCalendarDays, format } from "date-fns";
import { useLocation } from "wouter";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { useToast } from "@/hooks/use-toast";
import type { TwilioSettings } from "@shared/api-types";

export default function Settings() {
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("account");

  // Parse tab from URL query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const tab = urlParams.get('tab');
    if (tab && ['account', 'sms', 'billing'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);

  const { data: creds } = useQuery<TwilioSettings | null>({
    queryKey: ["/api/twilio/credentials"],
  });

  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [serviceSid, setServiceSid] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (creds) {
      setSid(creds.accountSid || "");
      setToken(creds.authToken || "");
      setServiceSid(creds.messagingServiceSid || "");
      setPhone(creds.phoneNumber || "");
    }
  }, [creds]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "POST",
        url: "/api/twilio/connect",
        data: {
          accountSid: sid,
          authToken: token,
          messagingServiceSid: serviceSid || undefined,
          phoneNumber: phone || undefined,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/twilio/credentials"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      toast({ title: "Success", description: "SMS settings updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  const changed =
    sid !== (creds?.accountSid || "") ||
    token !== (creds?.authToken || "") ||
    serviceSid !== (creds?.messagingServiceSid || "") ||
    phone !== (creds?.phoneNumber || "");

  const canSubmit = sid !== "" && token !== "" && changed && !updateMutation.isPending;

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
            <TabsTrigger value="sms">SMS Configuration</TabsTrigger>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" placeholder="Enter company name" />
                    </div>
                    <div>
                      <Label htmlFor="contact-email">Contact Email</Label>
                      <Input id="contact-email" type="email" placeholder="Enter contact email" />
                    </div>
                  </div>
                  <Button>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="sms">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>SMS Configuration</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="twilio-sid">Twilio Account SID</Label>
                      <Input
                        id="twilio-sid"
                        type="password"
                        placeholder="Enter Twilio Account SID"
                        value={sid}
                        onChange={(e) => setSid(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="twilio-token">Twilio Auth Token</Label>
                      <Input
                        id="twilio-token"
                        type="password"
                        placeholder="Enter Twilio Auth Token"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="messaging-sid">Messaging Service SID</Label>
                    <Input
                      id="messaging-sid"
                      placeholder="Enter Messaging Service SID"
                      value={serviceSid}
                      onChange={(e) => setServiceSid(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                    <Input
                      id="twilio-phone"
                      placeholder="Enter Twilio phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => updateMutation.mutate()} disabled={!canSubmit}>
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Update SMS Settings"}
                  </Button>
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
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 5);
  const daysLeft = differenceInCalendarDays(trialEnd, new Date());

  const handlePurchaseCredits = async () => {
    if (amount < 1) {
      toast({
        title: "Error",
        description: "Please select a valid amount of credits",
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
          amount,
          successUrl: `${window.location.origin}/checkout-success`,
          cancelUrl: `${window.location.origin}/settings?tab=billing`,
        },
      });

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = url;
    } catch (err: any) {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Current Plan</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-gray-700">14-Day Trial</p>
          <p className="text-sm text-gray-500">
            {`Your trial ends in ${daysLeft} days (${format(trialEnd, "MMMM d, yyyy")})`}
          </p>
        </CardContent>
      </Card>

      <div className="bg-blue-50 rounded-lg p-6 text-center">
        <p className="text-4xl font-bold text-blue-600">{credits?.balance ?? "--"}</p>
        <p className="text-gray-600 mt-1">Credits Remaining</p>
      </div>

      <Button onClick={() => setOpen(true)}>Buy Credits</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy Credits</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Purchase additional credits to send SMS campaigns. Each credit allows you to send one SMS message.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="credit-amount">Number of Credits</Label>
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100].map((value) => (
                  <Button
                    key={value}
                    variant={amount === value ? "default" : "outline"}
                    onClick={() => setAmount(value)}
                    className="w-full"
                  >
                    {value}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[250, 500].map((value) => (
                  <Button
                    key={value}
                    variant={amount === value ? "default" : "outline"}
                    onClick={() => setAmount(value)}
                    className="w-full"
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Price:</span> ${(amount * 0.01).toFixed(2)} USD
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
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Processing..." : "Purchase Credits"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

