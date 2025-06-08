import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tag } from "lucide-react";

export default function Coupons() {
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
              <span>Coupons Dashboard</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Coupons Coming Soon</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                This section will let you create and manage discount coupons for your marketing campaigns.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
