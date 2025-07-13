import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { 
  Target, 
  CheckSquare,
  Loader2, 
  ArrowRight,
  Info
} from "lucide-react";

export const useCaseOptions = [
  "Account Notifications",
  "Customer Care",
  "Charity / Nonprofit",
  "Delivery Notifications",
  "Fraud Alert Messaging",
  "Events",
  "Higher Education",
  "K–12 Education",
  "Marketing",
  "Polling and Voting (Non-Political)",
  "Political Election Campaigns",
  "Public Service Announcements",
] as const;

export type UseCaseOption = (typeof useCaseOptions)[number];

const schema = z.object({
  useCases: z.array(z.enum(useCaseOptions)).min(1, "Select at least one option"),
});

export interface UseCaseFormValues {
  useCases: UseCaseOption[];
}

interface UseCaseFormProps {
  initialValues?: UseCaseFormValues;
  onSubmit: (data: UseCaseFormValues) => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function UseCaseForm({
  initialValues,
  onSubmit,
  onBack,
  isSaving = false,
}: UseCaseFormProps) {
  const form = useForm<UseCaseFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      useCases: [],
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const selected = form.watch("useCases");

  const toggle = (option: UseCaseOption, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter((o) => o !== option);
    form.setValue("useCases", next, { shouldValidate: true });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <Target className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            SMS Use Cases
          </h3>
          <p className="text-sm text-gray-500">
            Select how you plan to use SMS messaging
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Use Cases Selection Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Message Types & Use Cases
            </Label>
            {selected.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {selected.length} selected
              </Badge>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Why We Need This</span>
            </div>
            <p className="text-sm text-blue-800">
              Different message types have different compliance requirements. 
              Selecting your use cases helps us configure your account for optimal deliverability.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {useCaseOptions.map((option, idx) => (
              <label 
                key={option} 
                className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Checkbox
                  id={`use-${idx}`}
                  checked={selected.includes(option)}
                  onCheckedChange={(checked) => toggle(option, !!checked)}
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {option}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {getUseCaseDescription(option)}
                  </p>
                </div>
              </label>
            ))}
          </div>

          {form.formState.errors.useCases && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
              <span>{form.formState.errors.useCases.message}</span>
            </p>
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
              disabled={!form.formState.isValid || isSaving}
              className="h-11 bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Save & Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Helper function to provide descriptions for use cases
function getUseCaseDescription(useCase: UseCaseOption): string {
  switch (useCase) {
    case "Account Notifications":
      return "Login alerts, security notifications, account updates";
    case "Customer Care":
      return "Support responses, help desk communications";
    case "Charity / Nonprofit":
      return "Fundraising, volunteer coordination, awareness campaigns";
    case "Delivery Notifications":
      return "Shipping updates, delivery confirmations";
    case "Fraud Alert Messaging":
      return "Security alerts, suspicious activity notifications";
    case "Events":
      return "Event reminders, ticket confirmations, updates";
    case "Higher Education":
      return "Campus alerts, enrollment, academic notifications";
    case "K–12 Education":
      return "School closures, parent communications, emergencies";
    case "Marketing":
      return "Promotional messages, sales, product announcements";
    case "Polling and Voting (Non-Political)":
      return "Surveys, feedback collection, community voting";
    case "Political Election Campaigns":
      return "Campaign updates, voter outreach, political messaging";
    case "Public Service Announcements":
      return "Emergency alerts, community information, government notices";
    default:
      return "";
  }
}
