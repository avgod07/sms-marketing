import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const campaignSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required"),
    message: z
      .string()
      .min(1, "Message is required")
      .max(160, "Message must be 160 characters or less"),
  });

export type CampaignFormValues = z.infer<typeof campaignSchema>;

interface CampaignFormProps {
  initialValues?: CampaignFormValues;
  onSubmit: (data: CampaignFormValues) => void;
  onCancel: () => void;
  pending?: boolean;
  submitLabel?: string;
  disabled?: boolean;
}

export default function CampaignForm({
  initialValues,
  onSubmit,
  onCancel,
  pending,
  submitLabel = "Save",
  disabled = false,
}: CampaignFormProps) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      message: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);


  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Campaign Name</Label>
          <Input id="name" {...form.register("name")} placeholder="Enter campaign name" />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            {...form.register("message")}
            placeholder="Enter your SMS message (max 160 characters)"
            className="resize-none"
            rows={3}
          />
          <div className="flex justify-between mt-1">
            {form.formState.errors.message && (
              <p className="text-sm text-red-600">{form.formState.errors.message.message}</p>
            )}
            <p className="text-sm text-gray-500 ml-auto">
              {form.watch("message")?.length || 0}/160
            </p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isValid || pending || disabled}
            className="flex-1"
          >
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
    </form>
  );
}
