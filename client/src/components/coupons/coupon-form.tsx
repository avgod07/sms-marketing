import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Tag, 
  Ticket, 
  Percent, 
  DollarSign, 
  Calendar, 
  Sparkles,
  Info,
  CheckCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

type CouponType = "percent" | "amount" | "free";

export const couponSchema = z
  .object({
    code: z.string().optional(),
    label: z.string().optional(),
    type: z.enum(["percent", "amount", "free"]),
    value: z.coerce
      .number({ invalid_type_error: "Enter a numeric value" })
      .nonnegative()
      .default(0),
    expirationDate: z.string().optional(),
  })
  .transform((data) => {
    // For free coupons, automatically set value to 0
    if (data.type === "free") {
      return { ...data, value: 0 };
    }
    return data;
  })
  .superRefine((data, ctx) => {
    if (data.type !== "free" && data.value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Value must be greater than 0",
        path: ["value"],
      });
    }

    if (data.type === "percent" && data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent must be between 1 and 100",
        path: ["value"],
      });
    }

    if (data.type === "percent" && data.value % 1 !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Percent must be a whole number",
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
      label: "",
      type: "percent",
      value: 0,
      expirationDate: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const watchedType = form.watch("type") as "percent" | "amount" | "free";
  const watchedValue = form.watch("value");
  const watchedCode = form.watch("code");

  // Automatically set value to 0 when type is "free" and trigger validation
  useEffect(() => {
    if (watchedType === "free") {
      form.setValue("value", 0);
      form.trigger("value"); // Trigger validation for the value field
    }
  }, [watchedType, form]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mx-auto">
          <Sparkles className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">
          {initialValues ? "Edit Coupon" : "Create New Coupon"}
        </h3>
        <p className="text-sm text-gray-600">
          {initialValues ? "Update your coupon details" : "Set up a new discount coupon for your customers"}
        </p>
      </div>

      <Separator />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Coupon Code Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-gray-500" />
            <Label htmlFor="code" className="text-sm font-medium text-gray-700">
              Coupon Code
            </Label>
          </div>
          <div className="space-y-2">
            <Input 
              id="code" 
              {...form.register("code")} 
              placeholder="Leave blank to auto-generate" 
              className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Info className="w-3 h-3" />
              <span>
                {watchedCode ? "Custom code will be used" : "A unique code will be generated automatically"}
              </span>
            </div>
            {form.formState.errors.code && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.code.message}</span>
              </p>
            )}
          </div>
        </div>

        {/* Label Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Ticket className="w-4 h-4 text-gray-500" />
            <Label htmlFor="label" className="text-sm font-medium text-gray-700">
              Label / Internal Note
            </Label>
            <Badge variant="secondary" className="text-xs">Optional</Badge>
          </div>
          <div className="space-y-2">
            <Input 
              id="label" 
              {...form.register("label")} 
              placeholder="e.g., Holiday Sale, VIP Customer, etc." 
              className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">
              This helps you organize and identify your coupons internally
            </p>
            {form.formState.errors.label && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.label.message}</span>
              </p>
            )}
          </div>
        </div>

        {/* Discount Type Section */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-gray-700">
            Discount Type
          </Label>
          <RadioGroup
            value={form.watch("type")}
            onValueChange={(val) => form.setValue("type", val as "percent" | "amount" | "free")}
            className="space-y-3"
          >
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              <RadioGroupItem id="type-percent" value="percent" />
              <div className="flex items-center space-x-2 flex-1">
                <span className="font-medium">Percentage Off</span>
              </div>
              <Badge variant="outline" className="text-xs">
                Most popular
              </Badge>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              <RadioGroupItem id="type-amount" value="amount" />
              <div className="flex items-center space-x-2 flex-1">
                <span className="font-medium">Fixed Amount Off</span>
              </div>
            </label>
            <label className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
              <RadioGroupItem id="type-free" value="free" />
              <div className="flex items-center space-x-2 flex-1">
                <span className="font-medium">Free Item or Service</span>
              </div>
            </label>
          </RadioGroup>
          {form.formState.errors.type && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
              <span>{form.formState.errors.type.message}</span>
            </p>
          )}
        </div>

        {/* Value Section */}
        {watchedType !== "free" && (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {watchedType === "percent" ? (
                <Percent className="w-4 h-4 text-gray-500" />
              ) : (
                <DollarSign className="w-4 h-4 text-gray-500" />
              )}
              <Label htmlFor="value" className="text-sm font-medium text-gray-700">
                {watchedType === "percent" ? "Percentage Value" : "Dollar Amount"}
              </Label>
            </div>
            <div className="space-y-2">
              <div className="relative">
                {watchedType === "amount" && (
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    $
                  </span>
                )}
                <Input
                  id="value"
                  type="number"
                  step={watchedType === "percent" ? "1" : "0.01"}
                  min={watchedType === "percent" ? "1" : "0"}
                  max={watchedType === "percent" ? "100" : undefined}
                  {...form.register("value")}
                  className={cn(
                    "transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                    watchedType === "amount" && "pl-8",
                    watchedType === "percent" && "pr-8"
                  )}
                  placeholder={watchedType === "percent" ? "Enter percentage (1-100)" : "Enter amount"}
                />
                {watchedType === "percent" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    %
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  {watchedType === "percent" 
                    ? "Enter a whole number between 1-100" 
                    : "Enter the dollar amount to discount"
                  }
                </p>
                {(watchedValue > 0 || (watchedType as any) === "free") && (
                  <div className="flex items-center space-x-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>
                      {/* @ts-ignore - TypeScript incorrectly narrowing enum type */}
                      {watchedType === "free" ? "Free Item/Service" :
                       watchedType === "percent" ? `${watchedValue}% off` :
                       `$${watchedValue} off`}
                    </span>
                  </div>
                )}
              </div>
              {form.formState.errors.value && (
                <p className="text-sm text-red-600 flex items-center space-x-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.value.message}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Expiration Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <Label htmlFor="expirationDate" className="text-sm font-medium text-gray-700">
              Expiration Date
            </Label>
            <Badge variant="secondary" className="text-xs">Optional</Badge>
          </div>
          <div className="space-y-2">
            <Input
              id="expirationDate"
              type="date"
              {...form.register("expirationDate")}
              className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500">
              Leave empty for no expiration date
            </p>
            {form.formState.errors.expirationDate && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.expirationDate.message}</span>
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            className="flex-1 h-11"
            disabled={pending}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!form.formState.isValid || pending} 
            className="flex-1 h-11 bg-blue-600 hover:bg-blue-700"
          >
            {pending ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4" />
                <span>{submitLabel}</span>
              </div>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
