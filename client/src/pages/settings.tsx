import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings as SettingsIcon, Save, Key, MessageSquare } from "lucide-react";

export default function Settings() {
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
                    defaultValue="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <Label htmlFor="twilio-token">Twilio Auth Token</Label>
                  <Input 
                    id="twilio-token" 
                    type="password" 
                    placeholder="Enter Twilio Auth Token"
                    defaultValue="••••••••••••••••••••••••••••••••"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="twilio-phone">Twilio Phone Number</Label>
                <Input 
                  id="twilio-phone" 
                  placeholder="Enter Twilio phone number"
                  defaultValue="+1234567890"
                />
              </div>
              <Button>
                <Save className="w-4 h-4 mr-2" />
                Update SMS Settings
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
