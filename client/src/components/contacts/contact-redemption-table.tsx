import { formatDate } from "@/lib/utils";
import type { ContactRedemption } from "@shared/api-types";

interface ContactRedemptionTableProps {
  redemptions: ContactRedemption[];
  isLoading: boolean;
}

export default function ContactRedemptionTable({
  redemptions,
  isLoading,
}: ContactRedemptionTableProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border-b">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-4 bg-gray-200 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  if (redemptions.length === 0) {
    return <p className="text-center py-8">No redemptions yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-medium text-gray-500">Code</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Note</th>
            <th className="text-left py-3 px-4 font-medium text-gray-500">Redeemed At</th>
          </tr>
        </thead>
        <tbody>
          {redemptions.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-4 px-4 text-gray-900">{r.code}</td>
              <td className="py-4 px-4 text-gray-900">{r.note || "—"}</td>
              <td className="py-4 px-4 text-gray-900">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
