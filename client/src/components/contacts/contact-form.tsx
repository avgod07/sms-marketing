import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput, normalizePhoneNumber } from "@/components/ui/phone-input";
import { 
  User, 
  Mail, 
  Phone,
  Shield,
  Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z
    .string()
    .min(1, "Phone number is required")
    .refine(
      (val) => {
        const digits = val.replace(/\D/g, "");
        return digits.length >= 10 && digits.length <= 11;
      },
      {
        message: "Please enter a valid 10-11 digit phone number",
      }
    ),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
});

export type ContactFormValues = z.infer<typeof contactSchema>;

interface ContactFormProps {
  initialValues?: ContactFormValues;
  onSubmit: (data: ContactFormValues) => void;
  onCancel: () => void;
  pending?: boolean;
  submitLabel?: string;
}

export default function ContactForm({
  initialValues,
  onSubmit,
  onCancel,
  pending,
  submitLabel = "Save",
}: ContactFormProps) {
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    mode: "onSubmit",
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const handleSubmit = (data: ContactFormValues) => {
    onSubmit({ ...data, phoneNumber: normalizePhoneNumber(data.phoneNumber) });
  };

  // Watch all required fields to make validation reactive
  const firstName = form.watch("firstName");
  const lastName = form.watch("lastName");
  const phoneNumber = form.watch("phoneNumber");

  // Check if required fields are filled
  const isFormValid = firstName && lastName && phoneNumber;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <Users className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Contact Information
          </h3>
          <p className="text-sm text-gray-500">
            Add a new contact to your SMS list
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Basic Information
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
                className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                  <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                  <span>{form.formState.errors.lastName.message}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Contact Details Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Phone className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Contact Details
            </Label>
          </div>

          <div>
            <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
              Phone Number
            </Label>
            <PhoneInput
              id="phoneNumber"
              value={form.watch("phoneNumber")}
              onChange={val => form.setValue("phoneNumber", val)}
              required
              className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {form.formState.errors.phoneNumber && (
              <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.phoneNumber.message}</span>
              </p>
            )}
            
            {/* Twilio Compliance Notice */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-2">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">SMS Consent</span>
                <Badge variant="secondary" className="text-xs">Required</Badge>
              </div>
              <p className="text-sm text-blue-800">
                By adding this contact, you confirm that they have consented to receive SMS messages from your business. 
                They can reply STOP to unsubscribe at any time.
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-gray-500" />
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </Label>
            </div>
            <Input 
              id="email" 
              type="email"
              {...form.register("email")} 
              placeholder="your.email@example.com"
              className="mt-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-600 flex items-center space-x-1 mt-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.email.message}</span>
              </p>
            )}
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            className="h-11"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={!isFormValid || pending}
            className="h-11 bg-blue-600 hover:bg-blue-700"
          >
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
