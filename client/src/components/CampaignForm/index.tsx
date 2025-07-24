import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, FileText, Send, TestTube2 } from "lucide-react";
import CreditUsageEstimate from "./CreditUsageEstimate";
import SmsPreview from "./SmsPreview";
import TestMessageModal from "./TestMessageModal";
import { 
  calculateTwilioSegmentation, 
  formatMessageTypeDisplay,
  getCharacterCounterLimit,
  validateMessageLength
} from "@/lib/twilio-segmentation";

export const campaignSchema = z
  .object({
    name: z.string().min(1, "Campaign name is required"),
    message: z
      .string()
      .trim()
      .min(1, "Message cannot be empty"),
  });

export type CampaignFormValues = z.infer<typeof campaignSchema> & { mediaUrl?: string };

interface CampaignFormProps {
  initialValues?: CampaignFormValues;
  onSubmit: (data: CampaignFormValues) => void;
  onCancel: () => void;
  pending?: boolean;
  submitLabel?: string;
  disabled?: boolean;
  onMessageChange?: (message: string) => void;
  onImageChange?: (url?: string) => void;
  onSendTest?: () => void;
}

export default function CampaignForm({
  initialValues,
  onSubmit,
  onCancel,
  pending,
  submitLabel = "Save",
  disabled = false,
  onMessageChange,
  onImageChange,
  onSendTest,
}: CampaignFormProps) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: initialValues || {
      name: "",
      message: "",
      mediaUrl: "",
    },
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "message" && onMessageChange) {
        onMessageChange(value.message || "");
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onMessageChange]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      setImageUrl(null);
      onImageChange?.(undefined);
      return;
    }
    if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
      alert("Only JPG, PNG, and GIF images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(previewUrl);
    setUploading(true);
    onImageChange?.(previewUrl);
    // Upload to backend
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch("/api/campaigns/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
      } else {
        alert(data.message || "Failed to upload image");
        setImageFile(null);
        setImagePreview(null);
        onImageChange?.(undefined);
      }
    } catch (err) {
      alert("Failed to upload image");
      setImageFile(null);
      setImagePreview(null);
      onImageChange?.(undefined);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
    onImageChange?.(undefined);
  };

  // Custom validation for message length and content
  const validateAndSubmit = (data: CampaignFormValues) => {
    const finalData = { ...data, mediaUrl: imageUrl || undefined };
    
    // Check for empty or whitespace-only messages
    const trimmedMessage = finalData.message.trim();
    if (!trimmedMessage) {
      form.setError("message", {
        type: "manual",
        message: "Message cannot be empty or contain only spaces"
      });
      return;
    }
    
    const hasImage = !!finalData.mediaUrl;
    const validation = validateMessageLength(trimmedMessage, hasImage);
    
    if (!validation.isValid) {
      form.setError("message", {
        type: "manual",
        message: validation.error || "Message exceeds maximum length"
      });
      return;
    }
    
    // Update finalData with trimmed message
    finalData.message = trimmedMessage;
    onSubmit(finalData);
  };

  const handleSendTest = () => {
    onSendTest?.();
  };

  return (
    <form onSubmit={form.handleSubmit(validateAndSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="name">Campaign Name</Label>
          <Input id="name" {...form.register("name")} placeholder="Enter campaign name" />
          {form.formState.errors.name && (
            <p className="text-sm text-red-600 mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div>
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            {...form.register("message")}
            placeholder="Enter your message (SMS ≤160 chars, MMS ≤1600 chars)"
            className="resize-none"
            rows={3}
          />
          <div className="flex justify-between mt-1">
            {form.formState.errors.message && (
              <p className="text-sm text-red-600">{form.formState.errors.message.message}</p>
            )}
            <div className="ml-auto text-sm space-y-1">
              {(() => {
                const currentMessage = form.watch("message") || "";
                const hasImage = !!imageUrl || !!imagePreview;
                const validation = validateMessageLength(currentMessage, hasImage);
                const messageInfo = calculateTwilioSegmentation(currentMessage, hasImage);
                const isOverLimit = !validation.isValid;
                const isNearLimit = validation.warningThreshold !== undefined;
                
                if (isOverLimit) {
                  return (
                    <div className="text-right">
                      <p className="text-red-600 font-medium">
                        {currentMessage.length}/1600
                      </p>
                      <p className="text-xs text-red-600">
                        Exceeds maximum limit
                      </p>
                    </div>
                  );
                }
                
                if (hasImage) {
                  return (
                    <div className="text-right">
                      <p className={isNearLimit ? "text-yellow-600" : "text-purple-600"}>
                        {currentMessage.length}/1600
                      </p>
                      <p className="text-xs text-purple-600">
                        MMS (3 credits)
                      </p>
                      {isNearLimit && (
                        <p className="text-xs text-yellow-600">
                          Approaching limit
                        </p>
                      )}
                    </div>
                  );
                }
                
                if (messageInfo.segments === 1 && currentMessage.length > 0) {
                  return (
                    <div className="text-right">
                      <p className="text-gray-500">
                        {currentMessage.length}/{messageInfo.characterLimit}
                      </p>
                      <p className="text-xs text-green-600">
                        Single SMS (1 credit)
                      </p>
                    </div>
                  );
                }
                
                // Empty message - show nothing
                if (currentMessage.length === 0) {
                  return null;
                }
                
                // Multi-segment SMS
                return (
                  <div className="text-right">
                    <p className={isNearLimit ? "text-yellow-600" : "text-orange-600"}>
                      {currentMessage.length} chars
                    </p>
                    {isNearLimit && (
                      <p className="text-xs text-yellow-600">
                        Approaching limit
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="image">Attach Image (Optional)</Label>
          <Input
            id="image"
            type="file"
            accept="image/jpeg,image/png,image/gif"
            onChange={handleImageChange}
            disabled={uploading}
          />
          {imagePreview && (
            <div className="mt-2">
              <img src={imagePreview} alt="Preview" className="max-h-32 rounded border" />
              <Button type="button" variant="outline" size="sm" onClick={handleRemoveImage} className="ml-2">Remove</Button>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-1">JPG, PNG, GIF only. Max 5MB. Sending an MMS costs 3 credits.</p>
        </div>

        <CreditUsageEstimate hasImage={!!imageUrl || !!imagePreview} message={form.watch("message") || ""} />

        <div className="flex space-x-2">
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleSendTest} 
            className="flex-1"
            disabled={!form.formState.isValid || disabled}
          >
            Send Test
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isValid || pending || disabled}
            className="flex-1"
          >
            {pending ? "Saving..." : submitLabel}
          </Button>
        </div>
    </form>
  );
}
