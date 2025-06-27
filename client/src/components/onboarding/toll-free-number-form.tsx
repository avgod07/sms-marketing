import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { cn, formatTollFree } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { handleApiError } from "@/lib/handleApiError";
import { Loader2 } from "lucide-react";

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
  const { toast } = useToast();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: numbers, isFetching } = useQuery<string[]>({
    queryKey: ["/api/onboarding/available-numbers", { page }],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest({
        method: "POST",
        url: "/api/twilio/tollfree",
        data: { phoneNumber: selected },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/setup/status"] });
      await apiRequest({ method: "POST", url: "/api/onboarding/complete" });
      toast({ title: "Success", description: "Phone number added" });
      onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: handleApiError(err),
        variant: "destructive",
      });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) mutation.mutate();
      }}
      className="space-y-4 max-w-xl mx-auto"
    >
      <p className="text-gray-700">Select a toll-free number for your SMS identity.</p>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {numbers?.map((num) => (
          <button
            type="button"
            key={num}
            onClick={() => setSelected(num)}
            className={cn(
              "border rounded p-2 text-sm",
              selected === num ? "bg-green-500 text-white" : "bg-white"
            )}
          >
            {formatTollFree(num)}
          </button>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isFetching}>
        See more numbers
      </Button>
      <div className="pt-4 flex items-center justify-between">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="ml-auto">
          <Button type="submit" disabled={!selected || mutation.isPending || isSaving}>
            {mutation.isPending || isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? "Submitting..." : "Save & Continue"}
          </Button>
        </div>
      </div>
    </form>
  );
}
