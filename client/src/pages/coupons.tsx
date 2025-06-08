import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CouponTable from "@/components/coupons/coupon-table";
import { Tag } from "lucide-react";
import type { Coupon } from "@shared/schema";

export default function Coupons() {
  const { data: coupons, isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
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
            <CardTitle className="flex items-center space-x-2">
              <Tag className="w-6 h-6" />
              <span>All Coupons</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CouponTable coupons={coupons || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
