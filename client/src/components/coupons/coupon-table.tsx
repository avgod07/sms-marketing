import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import type { Coupon } from "@shared/schema";
import { Edit, Trash2 } from "lucide-react";

interface CouponTableProps {
  coupons: Coupon[];
  isLoading: boolean;
  onEdit: (coupon: Coupon) => void;
  onDelete: (coupon: Coupon) => void;
}

export default function CouponTable({ coupons, isLoading, onEdit, onDelete }: CouponTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b">
            <div className="w-10 h-10 bg-gray-200 rounded-full" />
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
          <Edit className="w-6 h-6 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No coupons yet</h3>
        <p className="text-gray-500">Create your first coupon to get started</p>
      </div>
    );
  }

  const formatExpires = (coupon: Coupon) => {
    if (coupon.expirationDate) {
      return format(new Date(coupon.expirationDate), "PPP");
    }
    if (coupon.validDays) {
      return `${coupon.validDays} days`;
    }
    return "None";
  };

  const formatUsage = (coupon: Coupon) => {
    if (coupon.reusable) {
      return "Unlimited";
    }
    if (coupon.usageLimit) {
      return `${coupon.usageLimit} uses`;
    }
    return "Single";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Code</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Discount</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Expires</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Usage</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Actions</th>
          </tr>
        </thead>
        <tbody>
          {coupons.map(coupon => (
            <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-4 px-4">{coupon.code}</td>
              <td className="py-4 px-4">{coupon.discount}%</td>
              <td className="py-4 px-4">{formatExpires(coupon)}</td>
              <td className="py-4 px-4">{formatUsage(coupon)}</td>
              <td className="py-4 px-4">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(coupon)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(coupon)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
