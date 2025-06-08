import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { formatDate, getCouponStatusColor } from "@/lib/utils";
import type { Coupon } from "@shared/schema";

interface CouponTableProps {
  coupons: Coupon[];
  isLoading: boolean;
}

export default function CouponTable({ coupons, isLoading }: CouponTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b">
            <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/3"></div>
            </div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
            <div className="h-6 bg-gray-200 rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  if (coupons.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Tag className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons found</h3>
        <p className="text-gray-500">Coupons will appear here once created</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Code</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Type</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Value</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Usage</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Expires</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4 font-medium text-gray-900">{coupon.code}</td>
              <td className="py-4 px-4 capitalize text-gray-900">{coupon.type}</td>
              <td className="py-4 px-4 text-gray-900">
                {coupon.type === "percent" ? `${coupon.value}%` : `$${coupon.value}`}
              </td>
              <td className="py-4 px-4 text-gray-900">{coupon.usageCount}</td>
              <td className="py-4 px-4 text-gray-900">
                {coupon.expirationDate ? formatDate(coupon.expirationDate) : "—"}
              </td>
              <td className="py-4 px-4">
                <Badge className={getCouponStatusColor(coupon.status)}>{coupon.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
