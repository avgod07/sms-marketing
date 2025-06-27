import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

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
  onCancel?: () => void;
}

export default function UseCaseForm({
  initialValues,
  onSubmit,
  onBack,
  onCancel,
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl mx-auto">
      <div>
        <p className="mb-4 text-gray-700">Select all applicable use cases for your SMS traffic.</p>
        <div className="grid gap-2">
          {useCaseOptions.map((opt, idx) => (
            <label key={opt} className="flex items-center space-x-2">
              <Checkbox
                id={`use-${idx}`}
                checked={selected.includes(opt)}
                onCheckedChange={(c) => toggle(opt, !!c)}
              />
              <span className="text-sm" id={`label-use-${idx}`}>{opt}</span>
            </label>
          ))}
        </div>
        {form.formState.errors.useCases && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.useCases.message}</p>
        )}
      </div>
      <div className="pt-4 flex items-center justify-between">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="ml-auto space-x-2">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Save &amp; Close
            </Button>
          )}
          <Button type="submit" disabled={!form.formState.isValid}>Next</Button>
        </div>
      </div>
    </form>
  );
}
