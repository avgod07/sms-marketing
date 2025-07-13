import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Globe, 
  MapPin, 
  User, 
  Mail, 
  Phone,
  Loader2,
  CheckCircle,
  ArrowRight
} from "lucide-react";
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
    .transform((v) => {
      // Handle the https:// prefix automatically
      if (v && v.trim() && !v.startsWith("http://") && !v.startsWith("https://")) {
        return `https://${v.trim()}`;
      }
      return v;
    })
    .refine((v) => !v || /^https?:\/\/[^\s]+\.[^\s]+/.test(v), {
      message: "Enter a valid website URL",
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
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <Building2 className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Business Information
          </h3>
          <p className="text-sm text-gray-500">
            Required for Twilio verification
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Business Details Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Business Details
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="businessName" className="text-sm font-medium text-gray-700">
                Business Name
              </Label>
              <Input 
                id="businessName" 
                {...form.register("businessName")} 
                placeholder="Enter your business name"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.businessName && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.businessName.message}</span>
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <Label htmlFor="websiteUrl" className="text-sm font-medium text-gray-700">
                  Website URL
                </Label>
                <Badge variant="secondary" className="text-xs">Optional</Badge>
              </div>
              <div className="flex mt-1">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-gray-50 text-gray-500 text-sm">
                  https://
                </span>
                <Input 
                  id="websiteUrl" 
                  {...form.register("websiteUrl")} 
                  placeholder="yourwebsite.com"
                  className="rounded-l-none transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              {form.formState.errors.websiteUrl && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.websiteUrl.message}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Address Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Business Address
            </Label>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="address1" className="text-sm font-medium text-gray-700">
                Address Line 1
              </Label>
              <Input 
                id="address1" 
                {...form.register("address1")} 
                placeholder="Street address"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.address1 && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.address1.message}</span>
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="address2" className="text-sm font-medium text-gray-700">
                  Address Line 2
                </Label>
                <Badge variant="secondary" className="text-xs">Optional</Badge>
              </div>
              <Input 
                id="address2" 
                {...form.register("address2")} 
                placeholder="Suite, apartment, etc."
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city" className="text-sm font-medium text-gray-700">
                  City
                </Label>
                <Input 
                  id="city" 
                  {...form.register("city")} 
                  placeholder="City"
                  className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {form.formState.errors.city && (
                  <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    <span>{form.formState.errors.city.message}</span>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="state" className="text-sm font-medium text-gray-700">
                  State/Province
                </Label>
                <Select value={form.watch("state")} onValueChange={(v) => form.setValue("state", v)}>
                  <SelectTrigger id="state" className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
                  <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    <span>{form.formState.errors.state.message}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode" className="text-sm font-medium text-gray-700">
                  ZIP / Postal Code
                </Label>
                <Input 
                  id="postalCode" 
                  {...form.register("postalCode")} 
                  placeholder="ZIP code"
                  className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {form.formState.errors.postalCode && (
                  <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                    <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                    <span>{form.formState.errors.postalCode.message}</span>
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="country" className="text-sm font-medium text-gray-700">
                  Country
                </Label>
                <Select value={form.watch("country")} onValueChange={(v) => form.setValue("country", v)}>
                  <SelectTrigger id="country" className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
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
          </div>
        </div>

        <Separator />

        {/* Contact Information Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Contact Information
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">
                First Name
              </Label>
              <Input 
                id="firstName" 
                {...form.register("firstName")} 
                placeholder="First name"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.firstName.message}</span>
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">
                Last Name
              </Label>
              <Input 
                id="lastName" 
                {...form.register("lastName")} 
                placeholder="Last name"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.lastName.message}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email Address
                </Label>
              </div>
              <Input 
                id="email" 
                type="email" 
                {...form.register("email")} 
                placeholder="your.email@example.com"
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.email.message}</span>
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-gray-500" />
                <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                  Phone Number
                </Label>
              </div>
              <PhoneInput
                id="phoneNumber"
                value={form.watch("phoneNumber")}
                onChange={val => form.setValue("phoneNumber", val)}
                className="transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.phoneNumber && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.phoneNumber.message}</span>
                </p>
              )}
            </div>
          </div>
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
              disabled={!isFormValid() || isSaving}
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
