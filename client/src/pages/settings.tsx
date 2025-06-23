import { useState } from "react";
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
} from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { differenceInCalendarDays, format } from "date-fns";



export default function Settings() {


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
        <Tabs defaultValue="account" className="max-w-4xl">
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

          <TabsContent value="billing">
            <BillingTab />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}


function BillingTab() {
  const { data: credits } = useCredits();
  const [open, setOpen] = useState(false);

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 5);
  const daysLeft = differenceInCalendarDays(trialEnd, new Date());

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
        <p className="text-4xl font-bold text-blue-600">{credits ?? "--"}</p>
        <p className="text-gray-600 mt-1">Credits Remaining</p>
      </div>

      <Button onClick={() => setOpen(true)}>Buy Credits</Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy Credits</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Purchase additional credits here.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

