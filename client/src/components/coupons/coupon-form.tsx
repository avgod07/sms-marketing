import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

export const couponSchema = z
  .object({
    code: z.string().optional().or(z.literal("")),
    label: z.string().optional().or(z.literal("")),
    discount: z.coerce.number().min(1, "Discount is required").max(100),
    expirationDate: z.date().optional(),
    validDays: z.coerce.number().positive().int().optional(),
    usageLimit: z.coerce.number().positive().int().optional(),
    reusable: z.boolean().optional(),
  })
  .refine(data => !(data.expirationDate && data.validDays), {
    message: "Choose either expiration date or valid days",
    path: ["validDays"],
  })
  .refine(data => !(data.reusable && data.usageLimit), {
    message: "Either reusable or usage limit, not both",
    path: ["usageLimit"],
  });

export type CouponFormValues = z.infer<typeof couponSchema>;

interface CouponFormProps {
  initialValues?: CouponFormValues;
  onSubmit: (data: CouponFormValues) => void;
  onCancel: () => void;
  pending?: boolean;
  submitLabel?: string;
}

export default function CouponForm({
  initialValues,
  onSubmit,
  onCancel,
  pending,
  submitLabel = "Save",
}: CouponFormProps) {
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    mode: "onChange",
    defaultValues: {
      code: "",
      label: "",
      discount: 10,
      expirationDate: undefined,
      validDays: undefined,
      usageLimit: undefined,
      reusable: false,
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const watchExpiration = form.watch("expirationDate");
  const watchValidDays = form.watch("validDays");
  const watchReusable = form.watch("reusable");
  const watchUsageLimit = form.watch("usageLimit");

  // Clear mutually exclusive values when their counterpart is set
  useEffect(() => {
    if (watchExpiration) {
      form.setValue("validDays", undefined);
    }
  }, [watchExpiration, form]);

  useEffect(() => {
    if (watchValidDays) {
      form.setValue("expirationDate", undefined);
    }
  }, [watchValidDays, form]);

  useEffect(() => {
    if (watchReusable) {
      form.setValue("usageLimit", undefined);
    }
  }, [watchReusable, form]);

  useEffect(() => {
    if (watchUsageLimit) {
      form.setValue("reusable", false);
    }
  }, [watchUsageLimit, form]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="code">Coupon Code</Label>
        <Input id="code" {...form.register("code")}/>
        {form.formState.errors.code && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="label">Label / Note</Label>
        <Input id="label" {...form.register("label")}/>
        {form.formState.errors.label && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.label.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="discount">Discount (%)</Label>
        <Input type="number" id="discount" min={1} max={100} {...form.register("discount", { valueAsNumber: true })}/>
        {form.formState.errors.discount && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.discount.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Expiration Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={`w-full justify-start text-left font-normal ${!watchExpiration ? "text-muted-foreground" : ""}`}
              disabled={!!watchValidDays}
            >
              {watchExpiration ? format(watchExpiration, "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={watchExpiration}
              onSelect={date => form.setValue("expirationDate", date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {form.formState.errors.expirationDate && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.expirationDate.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="validDays">Valid for (days)</Label>
        <Input
          type="number"
          id="validDays"
          min={1}
          {...form.register("validDays", { valueAsNumber: true })}
          disabled={!!watchExpiration}
        />
        {form.formState.errors.validDays && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.validDays.message}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="reusable"
          checked={watchReusable}
          onCheckedChange={(checked) => form.setValue("reusable", checked)}
          disabled={!!watchUsageLimit}
        />
        <Label htmlFor="reusable">Reusable</Label>
      </div>
      <div>
        <Label htmlFor="usageLimit">Usage Limit</Label>
        <Input
          type="number"
          id="usageLimit"
          min={1}
          {...form.register("usageLimit", { valueAsNumber: true })}
          disabled={watchReusable}
        />
        {form.formState.errors.usageLimit && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.usageLimit.message}</p>
        )}
      </div>
      <div className="flex space-x-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={!form.formState.isValid || pending} className="flex-1">
          {pending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}
