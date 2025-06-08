import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export const couponSchema = z
  .object({
    code: z.string().optional(),
    type: z.enum(["percent", "amount", "free"]),
    value: z.coerce
      .number({ invalid_type_error: "Enter a numeric value" })
      .nonnegative(),
    expirationDate: z.string().optional(),
    usageLimit: z
      .preprocess(
        (v) => (v === "" || v === undefined ? undefined : Number(v)),
        z.number().int().positive(),
      )
      .optional(),
    reusable: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== "free" && data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Value must be greater than 0",
        path: ["value"],
      });
    }
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
      type: "percent",
      value: 0,
      expirationDate: "",
      usageLimit: undefined,
      reusable: true,
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
        <Label htmlFor="code">Coupon Code</Label>
        <Input id="code" {...form.register("code")} placeholder="Leave blank to auto-generate" />
        {form.formState.errors.code && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.code.message}</p>
        )}
      </div>
      <div>
        <Label>Discount Type</Label>
        <RadioGroup
          value={form.watch("type")}
          onValueChange={(val) => form.setValue("type", val as "percent" | "amount" | "free")}
          className="grid grid-cols-1 gap-2 sm:grid-cols-3 mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="type-percent" value="percent" />
            <Label htmlFor="type-percent">Percent Off</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="type-amount" value="amount" />
            <Label htmlFor="type-amount">Flat Amount Off</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem id="type-free" value="free" />
            <Label htmlFor="type-free">Free Item or Service</Label>
          </div>
        </RadioGroup>
        {form.formState.errors.type && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.type.message}</p>
        )}
      </div>
      {form.watch("type") !== "free" && (
        <div>
          <Label htmlFor="value">Value</Label>
          <Input id="value" type="number" step="0.01" {...form.register("value")} />
          {form.formState.errors.value && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.value.message}</p>
          )}
        </div>
      )}
      <div>
        <Label htmlFor="expirationDate">Expiration Date</Label>
        <Input id="expirationDate" type="date" {...form.register("expirationDate")} />
        {form.formState.errors.expirationDate && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.expirationDate.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="usageLimit">Usage Limit (optional)</Label>
        <Input id="usageLimit" type="number" {...form.register("usageLimit")} />
        {form.formState.errors.usageLimit && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.usageLimit.message}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="reusable"
          checked={form.watch("reusable")}
          onCheckedChange={(val) => form.setValue("reusable", val)}
        />
        <Label htmlFor="reusable">Reusable</Label>
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
