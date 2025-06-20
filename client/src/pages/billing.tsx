import { useState } from "react";
import { useCredits } from "@/hooks/use-credits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function Billing() {
  const { data: credits } = useCredits();
  const [open, setOpen] = useState(false);

  return (
    <div className="fade-in">
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
            <p className="text-gray-600 mt-1">Manage your subscription and credits.</p>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-4xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-gray-700">14-Day Trial</p>
            <p className="text-sm text-gray-500">Trial ends soon</p>
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
    </div>
  );
}
