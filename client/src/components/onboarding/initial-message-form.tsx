import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Shield, 
  Users,
  Loader2, 
  CheckCircle,
  Info,
  AlertCircle
} from "lucide-react";

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

  const isOverLimit = charCount > 160;
  const isCloseToLimit = charCount > 140;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <MessageSquare className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Welcome Message
          </h3>
          <p className="text-sm text-gray-500">
            Create your initial message for new contacts
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Message Input Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-500" />
            <Label htmlFor="initialMessage" className="text-sm font-medium text-gray-700">
              Welcome Message
            </Label>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Auto-sent Message</span>
            </div>
            <p className="text-sm text-blue-800">
              This message will be automatically sent to new contacts when they join your SMS list. 
              Make it welcoming and set proper expectations.
            </p>
          </div>

          <div className="space-y-2">
            <Textarea
              id="initialMessage"
              placeholder="Welcome to our service! We're excited to have you join us and will keep you updated with exclusive offers and important updates."
              {...form.register("initialMessage")}
              rows={4}
              className="resize-none transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">
                Your message (compliance text will be added automatically)
              </span>
              <div className={`flex items-center space-x-1 font-mono ${
                isOverLimit ? 'text-red-600' : 
                isCloseToLimit ? 'text-yellow-600' : 
                'text-gray-600'
              }`}>
                {isOverLimit && <AlertCircle className="w-3 h-3" />}
                <span>{charCount}/160</span>
              </div>
            </div>
            {form.formState.errors.initialMessage && (
              <p className="text-sm text-red-600 flex items-center space-x-1">
                <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                <span>{form.formState.errors.initialMessage.message}</span>
              </p>
            )}
          </div>
        </div>

        {/* Compliance Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Compliance & Preview
            </Label>
            <Badge variant="secondary" className="text-xs">Required</Badge>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">
                Final Message Preview:
              </span>
              <Badge 
                variant={isOverLimit ? "destructive" : "secondary"} 
                className="text-xs"
              >
                {isOverLimit ? "Too Long" : "Valid"}
              </Badge>
            </div>
            <div className={`p-3 bg-white rounded border-2 ${
              isOverLimit ? 'border-red-200' : 'border-gray-200'
            }`}>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {watchedMessage || "Your message will appear here..."} 
                {watchedMessage && !watchedMessage.includes(complianceText) && (
                  <span className="text-gray-500 ml-1">{complianceText}</span>
                )}
              </p>
            </div>
            {isOverLimit && (
              <p className="text-sm text-red-600 flex items-center space-x-1 mt-2">
                <AlertCircle className="w-3 h-3" />
                <span>Message exceeds 160 characters. Please shorten your message.</span>
              </p>
            )}
          </div>

          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <div className="flex items-center space-x-2 mb-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">Compliance Note</span>
            </div>
            <p className="text-sm text-amber-800">
              The compliance text "Text STOP to unsubscribe." is automatically added 
              to ensure SMS regulations compliance and is included in the character count.
            </p>
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
                  <span>Completing Setup...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Setup</span>
                </div>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
} 