import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const campaignSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required"),
    message: z
      .string()
      .min(1, "Message is required")
      .max(160, "Message must be 160 characters or less"),
    audience: z.string().min(1, "Audience is required"),
    frequency: z.enum(["one-time", "recurring"]),
    sendTime: z.enum(["immediate", "scheduled"]),
    scheduledAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.sendTime === "scheduled" && !data.scheduledAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a date and time",
        path: ["scheduledAt"],
      });
    }
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
      audience: "all",
      frequency: "one-time",
      sendTime: "immediate",
      scheduledAt: "",
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
          <Label htmlFor="audience">Audience</Label>
          <Select
            onValueChange={(value) => form.setValue("audience", value)}
            value={form.watch("audience")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="active">Active Contacts</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.audience && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.audience.message}</p>
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
        <div>
          <Label>Frequency</Label>
          <RadioGroup
            value={form.watch("frequency")}
            onValueChange={(val) => form.setValue("frequency", val as "one-time" | "recurring")}
            className="flex space-x-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="freq-once" value="one-time" />
              <Label htmlFor="freq-once">One-time</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="freq-recurring" value="recurring" />
              <Label htmlFor="freq-recurring">Recurring</Label>
            </div>
          </RadioGroup>
        </div>
        <div>
          <Label>Send Time</Label>
          <RadioGroup
            value={form.watch("sendTime")}
            onValueChange={(val) => form.setValue("sendTime", val as "immediate" | "scheduled")}
            className="flex space-x-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="send-now" value="immediate" />
              <Label htmlFor="send-now">Immediate</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem id="send-scheduled" value="scheduled" />
              <Label htmlFor="send-scheduled">Scheduled</Label>
            </div>
          </RadioGroup>
          {form.watch("sendTime") === "scheduled" && (
            <Input
              id="scheduledAt"
              type="datetime-local"
              className="mt-2"
              {...form.register("scheduledAt")}
            />
          )}
          {form.formState.errors.scheduledAt && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.scheduledAt.message}</p>
          )}
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
