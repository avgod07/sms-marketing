import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn, formatTollFree } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { 
  Phone, 
  RefreshCw, 
  Check,
  Loader2, 
  ArrowRight,
  Info
} from "lucide-react";

interface TollFreeNumberFormProps {
  onSuccess: () => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function TollFreeNumberForm({
  onSuccess,
  onBack,
  isSaving = false,
}: TollFreeNumberFormProps) {
  const [selected, setSelected] = useState<string>("");
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  const { data: numbers, isFetching } = useQuery<string[]>({
    queryKey: [`/api/twilio/available-tollfree?page=${page}`],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("No number selected");
      await apiRequest({
        method: "POST",
        url: "/api/twilio/tollfree",
        data: { phoneNumber: selected },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: handleApiError(error),
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <Phone className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Toll-Free Number
          </h3>
          <p className="text-sm text-gray-500">
            Choose your dedicated phone number
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (selected) mutation.mutate();
          }}
          className="space-y-6"
        >
          {/* Number Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <Label className="text-sm font-medium text-gray-700">
                  Available Numbers
                </Label>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setPage((p) => p + 1)} 
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                More Numbers
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Info className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">About Toll-Free Numbers</span>
              </div>
              <p className="text-sm text-blue-800">
                Toll-free numbers (800, 888, 877, etc.) provide better deliverability for SMS marketing 
                and give your business a professional appearance.
              </p>
            </div>

            {numbers && numbers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {numbers.map((number: string) => (
                  <button
                    type="button"
                    key={number}
                    onClick={() => setSelected(number)}
                    className={cn(
                      "relative p-4 border-2 rounded-lg text-center transition-all duration-200 hover:border-blue-300",
                      selected === number 
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500" 
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    )}
                  >
                    <div className="text-lg font-mono font-semibold text-gray-900">
                      {formatTollFree(number)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Toll-Free Number
                    </div>
                    {selected === number && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4">
                  {isFetching ? (
                    <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                  ) : (
                    <Phone className="w-6 h-6 text-gray-500" />
                  )}
                </div>
                <p className="text-gray-500">
                  {isFetching ? "Loading available numbers..." : "No numbers available. Please refresh."}
                </p>
              </div>
            )}

            {selected && (
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Selected Number</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-mono font-semibold text-green-800">
                      {formatTollFree(selected)}
                    </p>
                    <p className="text-sm text-green-700">
                      This will be your SMS sender identity
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    Ready to Purchase
                  </Badge>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4">
            {onBack && (
              <Button type="button" variant="outline" onClick={onBack} className="h-11">
                Back
              </Button>
            )}
            <div className="ml-auto">
              <Button 
                type="submit" 
                disabled={!selected || mutation.isPending || isSaving}
                className="h-11 bg-blue-600 hover:bg-blue-700"
              >
                {mutation.isPending || isSaving ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{mutation.isPending ? "Purchasing..." : "Saving..."}</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>Purchase & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
