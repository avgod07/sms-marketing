import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z
    .string()
    .regex(/^\+?1?\d{10}$/, "Enter a valid 10-digit US phone number"),
  email: z.string().email().optional().or(z.literal("")),
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
    mode: "onChange",
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="firstName">First Name</Label>
        <Input id="firstName" {...form.register("firstName")} placeholder="First name" />
        {form.formState.errors.firstName && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.firstName.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="lastName">Last Name</Label>
        <Input id="lastName" {...form.register("lastName")} placeholder="Last name" />
        {form.formState.errors.lastName && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.lastName.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="phoneNumber">Phone Number</Label>
        <Input id="phoneNumber" {...form.register("phoneNumber")} placeholder="+15551234567" />
        {form.formState.errors.phoneNumber && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.phoneNumber.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" {...form.register("email")} placeholder="optional" />
        {form.formState.errors.email && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.email.message}</p>
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
