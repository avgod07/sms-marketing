import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Info, Calendar } from "lucide-react";
import type { KeywordCampaign } from "@shared/schema";

const keywordFormSchema = z.object({
  keyword: z
    .string()
    .min(1, "Keyword is required")
    .max(50, "Keyword must be 50 characters or less")
    .regex(/^[A-Za-z0-9]+$/, "Keyword must contain only letters and numbers"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(160, "Message must be 160 characters or less"),
  expiresAt: z.string().optional().or(z.literal("")).refine(
    (val) => {
      if (!val || val.trim() === "") return true; // Optional field
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    },
    {
      message: "Expiration date cannot be in the past",
    }
  ),
});

type KeywordFormData = z.infer<typeof keywordFormSchema>;

interface KeywordFormProps {
  initialData?: KeywordCampaign | null;
  onSubmit: (data: KeywordFormData) => void;
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
}

export default function KeywordForm({
  initialData,
  onSubmit,
  onCancel,
  pending,
  submitLabel,
}: KeywordFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<KeywordFormData>({
    resolver: zodResolver(keywordFormSchema),
    defaultValues: {
      keyword: initialData?.keyword || "",
      message: initialData?.message || "",
      expiresAt: initialData?.expiresAt 
        ? new Date(initialData.expiresAt).toISOString().split('T')[0] 
        : "",
    },
  });

  const watchedKeyword = watch("keyword");
  const watchedMessage = watch("message");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Info Box */}
        <div className="border rounded-lg p-4 bg-blue-50">
          <div className="flex items-start space-x-2">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-blue-900">How Keyword Responses Work</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Each contact gets the auto-response <strong>only once per keyword</strong></li>
                <li>• If they text the same keyword again, no response is sent</li>
                <li>• "STOP" commands always take priority over keywords</li>
                <li>• Responses are sent instantly when the keyword is received</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Keyword Input */}
        <div>
          <Label htmlFor="keyword">Keyword</Label>
          <Input
            id="keyword"
            placeholder="e.g., JOIN, SUBSCRIBE, INFO"
            {...register("keyword")}
            className={errors.keyword ? "border-red-500" : ""}
          />
          <p className="text-gray-500 text-sm mt-1">
            Must be a single word (letters and numbers only)
          </p>
          {errors.keyword && (
            <p className="text-red-500 text-sm mt-1">{errors.keyword.message}</p>
          )}
        </div>

        {/* Message Textarea */}
        <div>
          <Label htmlFor="message">Auto-Response Message</Label>
          <Textarea
            id="message"
            rows={4}
            placeholder="Enter the message to send when someone texts this keyword..."
            {...register("message")}
            className={errors.message ? "border-red-500" : ""}
          />
          <div className="flex justify-between mt-1">
            {errors.message && (
              <p className="text-red-500 text-sm">{errors.message.message}</p>
            )}
            <p className="text-gray-500 text-sm">
              {watchedMessage?.length || 0}/160 characters
            </p>
          </div>
          <p className="text-gray-500 text-sm mt-1">
            Remember to include "Text STOP to unsubscribe" for compliance
          </p>
        </div>

        {/* Preview Section */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <Label className="text-sm font-medium">Preview Flow</Label>
          <div className="mt-2 space-y-3">
            <div className="text-sm">
              <span className="font-medium">Customer texts:</span> 
              <span className="bg-blue-100 px-2 py-1 rounded ml-2">
                {watchedKeyword?.toUpperCase() || "KEYWORD"}
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">Auto-response sent:</span>
              <div className="bg-white border rounded p-2 mt-1">
                {watchedMessage || "Your auto-response message will appear here..."}
              </div>
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">If same customer texts keyword again:</span>
              <div className="italic ml-2">No response sent (they already received it)</div>
            </div>
          </div>
        </div>

        {/* Expiration Date */}
        <div>
          <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
          <div className="relative">
            <Input
              id="expiresAt"
              type="date"
              {...register("expiresAt")}
              className={`pl-10 ${errors.expiresAt ? "border-red-500" : ""}`}
              min={new Date().toISOString().split('T')[0]}
            />
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>
          {errors.expiresAt && (
            <p className="text-red-500 text-sm mt-1">{errors.expiresAt.message}</p>
          )}
          <p className="text-gray-500 text-sm mt-1">
            If set, keyword will automatically stop responding after this date (cannot be in the past)
          </p>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex space-x-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {initialData ? "Updating..." : "Creating..."}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
} 