import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CouponForm, { type CouponFormValues } from "@/components/coupons/coupon-form";
import CouponTable from "@/components/coupons/coupon-table";
import { Tag, Plus } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Coupon } from "@shared/schema";

export default function Coupons() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  const createCouponMutation = useMutation({
    mutationFn: (data: CouponFormValues) =>
      apiRequest({ method: "POST", url: "/api/coupons", data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsCreateOpen(false);
      toast({ title: "Coupon Created" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="fade-in">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
            <p className="text-gray-600 mt-1">
              Manage discount coupons for your campaigns.
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Tag className="w-6 h-6" />
                <span>All Coupons</span>
              </CardTitle>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Coupon
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <CouponTable coupons={coupons || []} isLoading={isLoading} />
          </CardContent>
        </Card>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Coupon</DialogTitle>
            </DialogHeader>
            <CouponForm
              onSubmit={(data: CouponFormValues) => createCouponMutation.mutate(data)}
              onCancel={() => setIsCreateOpen(false)}
              pending={createCouponMutation.isPending}
              submitLabel="Create Coupon"
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
