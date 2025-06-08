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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CouponForm, { type CouponFormValues } from "@/components/coupons/coupon-form";
import CouponTable from "@/components/coupons/coupon-table";
import { Tag, Plus } from "lucide-react";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Coupon, CouponRedemption } from "@shared/schema";
import RedemptionTable from "@/components/coupons/redemption-table";

export default function Coupons() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [redeemPhone, setRedeemPhone] = useState("");
  const [redeemNote, setRedeemNote] = useState("");
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCoupon, setHistoryCoupon] = useState<Coupon | null>(null);
  const { toast } = useToast();

  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  const {
    data: redemptions,
    isLoading: redemptionsLoading,
  } = useQuery<CouponRedemption[]>({
    queryKey: historyCoupon
      ? [`/api/coupons/${historyCoupon.id}/redemptions`]
      : [],
    enabled: !!historyCoupon,
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const createCouponMutation = useMutation({
    mutationFn: async (data: CouponFormValues) => {
      const payload = {
        ...data,
        value: data.type === "free" ? "0" : data.value.toString(),
        expirationDate: data.expirationDate
          ? new Date(data.expirationDate)
          : undefined,
        validDays: data.validDays ?? undefined,
      };
      const res = await apiRequest({
        method: "POST",
        url: "/api/coupons",
        data: payload,
      });
      return (await res.json()) as Coupon;
    },
    onSuccess: (coupon: Coupon) => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsCreateOpen(false);
      toast({
        title: "Coupon Created",
        description: `Code: ${coupon.code}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    },
  });

  const redeemCouponMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCoupon) return;
      await apiRequest({
        method: "POST",
        url: `/api/coupons/${selectedCoupon.code}/redeem`,
        data: { phoneNumber: redeemPhone || undefined, note: redeemNote || undefined },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsRedeemOpen(false);
      setRedeemPhone("");
      setRedeemNote("");
      setSelectedCoupon(null);
      toast({ title: "Coupon Redeemed" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to redeem coupon",
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
            <CouponTable
              coupons={coupons || []}
              isLoading={isLoading}
              onRedeem={(c) => {
                setSelectedCoupon(c);
                setIsRedeemOpen(true);
              }}
              onViewRedemptions={(c) => {
                setHistoryCoupon(c);
                setIsHistoryOpen(true);
              }}
            />
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
        <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Redeem Coupon</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-700">
                Redeeming {selectedCoupon?.code}
              </p>
              <div>
                <Label htmlFor="phone">Customer Phone (optional)</Label>
                <Input
                  id="phone"
                  value={redeemPhone}
                  onChange={(e) => setRedeemPhone(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  value={redeemNote}
                  onChange={(e) => setRedeemNote(e.target.value)}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsRedeemOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => redeemCouponMutation.mutate()}
                  disabled={redeemCouponMutation.isPending || !selectedCoupon}
                  className="flex-1"
                >
                  {redeemCouponMutation.isPending ? "Redeeming..." : "Redeem"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog
          open={isHistoryOpen}
          onOpenChange={(open) => {
            setIsHistoryOpen(open);
            if (!open) setHistoryCoupon(null);
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Redemption History for {historyCoupon?.code}
              </DialogTitle>
            </DialogHeader>
            <RedemptionTable
              redemptions={redemptions || []}
              isLoading={redemptionsLoading}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
