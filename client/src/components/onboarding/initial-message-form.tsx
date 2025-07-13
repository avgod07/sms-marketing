import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const initialMessageSchema = z.object({
  initialMessage: z
    .string()
    .min(1, "Initial message is required")
    .max(160, "Initial message must be 160 characters or less"),
});

export type InitialMessageFormValues = z.infer<typeof initialMessageSchema>;

interface InitialMessageFormProps {
  initialValues?: InitialMessageFormValues;
  onSubmit: (data: InitialMessageFormValues) => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function InitialMessageForm({
  initialValues,
  onSubmit,
  onBack,
  isSaving = false,
}: InitialMessageFormProps) {
  const [charCount, setCharCount] = useState(0);
  const complianceText = "Text STOP to unsubscribe.";
  
  const form = useForm<InitialMessageFormValues>({
    resolver: zodResolver(initialMessageSchema),
    mode: "onChange",
    defaultValues: {
      initialMessage: "",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const watchedMessage = form.watch("initialMessage");
  
  useEffect(() => {
    const message = watchedMessage || "";
    const finalMessage = message.includes(complianceText) 
      ? message 
      : `${message} ${complianceText}`;
    setCharCount(finalMessage.length);
  }, [watchedMessage, complianceText]);

  const handleSubmit = (data: InitialMessageFormValues) => {
    onSubmit(data);
  };

  const isFormValid = () => {
    const values = form.getValues();
    return !!(values.initialMessage && charCount <= 160);
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Set Your Welcome Message</h2>
        <p className="text-gray-600">
          This message will be automatically sent to new contacts when they join your list.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="initialMessage">Welcome Message</Label>
          <Textarea
            id="initialMessage"
            placeholder="Welcome to our service! We're excited to have you join us."
            {...form.register("initialMessage")}
            rows={4}
            className="resize-none"
          />
          {form.formState.errors.initialMessage && (
            <p className="text-sm text-red-600 mt-1">
              {form.formState.errors.initialMessage.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              Final message (with compliance text):
            </span>
            <span className={`font-mono ${charCount > 160 ? 'text-red-600' : 'text-gray-600'}`}>
              {charCount}/160
            </span>
          </div>
          <div className="p-3 bg-gray-50 rounded-md border">
            <p className="text-sm text-gray-700">
              {watchedMessage || "Your message will appear here..."} 
              {watchedMessage && !watchedMessage.includes(complianceText) && (
                <span className="text-gray-500"> {complianceText}</span>
              )}
            </p>
          </div>
          {charCount > 160 && (
            <p className="text-sm text-red-600">
              Message exceeds 160 characters. Please shorten your message.
            </p>
          )}
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
              Complete Setup
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
} 