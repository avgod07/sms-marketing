import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput, normalizePhoneNumber, formatPhoneNumber } from "@/components/ui/phone-input";

export const states = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

export const countries = ["United States"];

export const businessInfoSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  websiteUrl: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^https?:\/\//.test(v), {
      message: "Enter a valid URL",
    }),
  address1: z.string().min(1, "Address Line 1 is required"),
  address2: z.string().optional().nullable().or(z.literal("")),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email({ message: "Invalid email" }),
  phoneNumber: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?1?\s*\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/, "Please enter a valid phone number"),
});

export type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

interface BusinessInfoFormProps {
  initialValues?: BusinessInfoFormValues;
  onSubmit: (data: BusinessInfoFormValues) => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function BusinessInfoForm({
  initialValues,
  onSubmit,
  onBack,
  isSaving = false,
}: BusinessInfoFormProps) {
  
  const form = useForm<BusinessInfoFormValues>({
    resolver: zodResolver(businessInfoSchema),
    mode: "onSubmit",
    defaultValues: {
      businessName: "",
      websiteUrl: "",
      address1: "",
      address2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "United States",
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      // Convert +1 format back to display format for the form
      const displayValues = {
        ...initialValues,
        phoneNumber: initialValues.phoneNumber 
          ? formatPhoneNumber(initialValues.phoneNumber)
          : ''
      };
      form.reset(displayValues);
    }
  }, [initialValues, form]);

  const handleSubmit = (data: BusinessInfoFormValues) => {
    const normalizedData = {
      ...data,
      phoneNumber: normalizePhoneNumber(data.phoneNumber)
    };
    onSubmit(normalizedData);
  };

  // Check if required fields are filled
  const isFormValid = () => {
    const values = form.getValues();
    return !!(
      values.businessName &&
      values.address1 &&
      values.city &&
      values.state &&
      values.postalCode &&
      values.country &&
      values.firstName &&
      values.lastName &&
      values.email &&
      values.phoneNumber
    );
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-w-xl mx-auto">
      <div>
        <Label htmlFor="businessName">Business Name</Label>
        <Input id="businessName" {...form.register("businessName")} />
        {form.formState.errors.businessName && (
          <p className="text-sm text-red-600 mt-1">
            {form.formState.errors.businessName.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="websiteUrl">Website URL</Label>
        <div className="flex">
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-gray-50 text-gray-500 text-sm">
            https://
          </span>
          <Input id="websiteUrl" {...form.register("websiteUrl")} className="rounded-l-none" />
        </div>
        {form.formState.errors.websiteUrl && (
          <p className="text-sm text-red-600 mt-1">
            {form.formState.errors.websiteUrl.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="address1">Address Line 1</Label>
        <Input id="address1" {...form.register("address1")} />
        {form.formState.errors.address1 && (
          <p className="text-sm text-red-600 mt-1">
            {form.formState.errors.address1.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="address2">Address Line 2</Label>
        <Input id="address2" {...form.register("address2")} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" {...form.register("city")} />
          {form.formState.errors.city && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.city.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="state">State/Province</Label>
          <Select value={form.watch("state")} onValueChange={(v) => form.setValue("state", v)}>
            <SelectTrigger id="state">
              <SelectValue placeholder="Select state" />
            </SelectTrigger>
            <SelectContent>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.state && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.state.message}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="postalCode">ZIP / Postal</Label>
          <Input id="postalCode" {...form.register("postalCode")} />
          {form.formState.errors.postalCode && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.postalCode.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="country">Country</Label>
          <Select value={form.watch("country")} onValueChange={(v) => form.setValue("country", v)}>
            <SelectTrigger id="country">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input id="firstName" {...form.register("firstName")} />
          {form.formState.errors.firstName && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.firstName.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input id="lastName" {...form.register("lastName")} />
          {form.formState.errors.lastName && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.lastName.message}
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="phoneNumber">Phone Number</Label>
          <PhoneInput
            id="phoneNumber"
            value={form.watch("phoneNumber")}
            onChange={val => form.setValue("phoneNumber", val)}
          />
          {form.formState.errors.phoneNumber && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.phoneNumber.message}
            </p>
          )}
        </div>
      </div>
      <div className="pt-4 flex items-center justify-between">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack}>
            Back
          </Button>
        )}
        <div className="ml-auto">
          <Button type="submit" disabled={!isFormValid() || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Continue
          </Button>
        </div>
      </div>
    </form>
  );
}
