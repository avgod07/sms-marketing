import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Save, Key, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { handleApiError } from "@/lib/handleApiError";
import { useToast } from "@/hooks/use-toast";
import type { TwilioSettings } from "@shared/api-types";

export default function Settings() {
  const { toast } = useToast();

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
      {/* Header */}
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

      {/* Content */}
      <div className="p-8 max-w-4xl">
        <div className="space-y-6">
          {/* Account Settings */}
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

          {/* SMS Configuration */}
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

          {/* API Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>API Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="api-key">API Key</Label>
                <div className="flex space-x-2">
                  <Input 
                    id="api-key" 
                    type="password" 
                    value="tk_••••••••••••••••••••••••••••••••"
                    readOnly
                  />
                  <Button variant="outline">Regenerate</Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Use this API key to integrate with external services
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
