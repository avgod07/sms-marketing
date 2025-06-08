import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const couponSchema = z.object({
  code: z.string().optional(),
  type: z.enum(["percent", "amount"]),
  value: z.coerce
    .number({ invalid_type_error: "Enter a numeric value" })
    .positive("Value must be greater than 0"),
  expirationDate: z.string().optional(),
  usageLimit: z
    .preprocess(
      (v) => (v === "" || v === undefined ? undefined : Number(v)),
      z.number().int().positive(),
    )
    .optional(),
  reusable: z.boolean().optional(),
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
        <Label htmlFor="type">Type</Label>
        <Select
          onValueChange={(value) => form.setValue("type", value as "percent" | "amount")}
          value={form.watch("type")}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="amount">Fixed Amount</SelectItem>
            <SelectItem value="percent">Percent Off</SelectItem>
          </SelectContent>
        </Select>
        {form.formState.errors.type && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.type.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="value">Value</Label>
        <Input id="value" type="number" step="0.01" {...form.register("value")} />
        {form.formState.errors.value && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.value.message}</p>
        )}
      </div>
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
