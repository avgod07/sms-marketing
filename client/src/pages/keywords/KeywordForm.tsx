import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Keyword {
  id: number;
  keyword: string;
  welcomeMessage: string;
  isActive: boolean;
  optInCount: number;
  createdAt: string;
  updatedAt: string;
}

interface KeywordFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  keyword?: Keyword | null;
}

export function KeywordForm({ open, onClose, onSuccess, keyword }: KeywordFormProps) {
  const [formData, setFormData] = useState({
    keyword: "",
    welcomeMessage: "",
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Reset form when dialog opens/closes or keyword changes
  useEffect(() => {
    if (open) {
      if (keyword) {
        setFormData({
          keyword: keyword.keyword,
          welcomeMessage: keyword.welcomeMessage,
          isActive: keyword.isActive,
        });
      } else {
        setFormData({
          keyword: "",
          welcomeMessage: "",
          isActive: true,
        });
      }
      setErrors({});
    }
  }, [open, keyword]);

  // Create keyword mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/api/keywords", data),
    onSuccess: () => {
      toast({ title: "Keyword created successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        toast({ title: error.response.data.message, variant: "destructive" });
      } else {
        toast({ title: "Failed to create keyword", variant: "destructive" });
      }
    },
  });

  // Update keyword mutation
  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api.put(`/api/keywords/${keyword?.id}`, data),
    onSuccess: () => {
      toast({ title: "Keyword updated successfully" });
      onSuccess();
    },
    onError: (error: any) => {
      if (error.response?.data?.message) {
        toast({ title: error.response.data.message, variant: "destructive" });
      } else {
        toast({ title: "Failed to update keyword", variant: "destructive" });
      }
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.keyword.trim()) {
      newErrors.keyword = "Keyword is required";
    } else if (!/^[A-Z0-9]+$/.test(formData.keyword.toUpperCase())) {
      newErrors.keyword = "Keyword must contain only uppercase letters and numbers";
    } else if (formData.keyword.length > 20) {
      newErrors.keyword = "Keyword must be 20 characters or less";
    }

    if (!formData.welcomeMessage.trim()) {
      newErrors.welcomeMessage = "Welcome message is required";
    } else if (formData.welcomeMessage.length > 160) {
      newErrors.welcomeMessage = "Welcome message must be 160 characters or less";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const submitData = {
      ...formData,
      keyword: formData.keyword.toUpperCase(),
    };

    if (keyword) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Calculate character count for SMS compliance
  const characterCount = formData.welcomeMessage.length;
  const isOverLimit = characterCount > 160;

  // Preview with variable substitution
  const previewMessage = formData.welcomeMessage
    .replace(/{firstName}/g, "John")
    .replace(/{businessName}/g, "Your Business");

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {keyword ? "Edit Keyword" : "Add New Keyword"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Keyword Input */}
          <div className="space-y-2">
            <Label htmlFor="keyword">Keyword</Label>
            <Input
              id="keyword"
              value={formData.keyword}
              onChange={(e) => handleInputChange("keyword", e.target.value)}
              placeholder="e.g., JOIN, VIP, SALE"
              className={errors.keyword ? "border-destructive" : ""}
            />
            {errors.keyword && (
              <p className="text-sm text-destructive">{errors.keyword}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Customers will text this keyword to opt-in. Use only uppercase letters and numbers.
            </p>
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              value={formData.welcomeMessage}
              onChange={(e) => handleInputChange("welcomeMessage", e.target.value)}
              placeholder="Thanks for joining {businessName}! You'll receive updates from us."
              rows={4}
              className={errors.welcomeMessage ? "border-destructive" : ""}
            />
            <div className="flex justify-between items-center text-xs">
              <span className={isOverLimit ? "text-destructive" : "text-muted-foreground"}>
                {characterCount}/160 characters
              </span>
              <span className="text-muted-foreground">
                Available variables: {"{firstName}"}, {"{businessName}"}
              </span>
            </div>
            {errors.welcomeMessage && (
              <p className="text-sm text-destructive">{errors.welcomeMessage}</p>
            )}
          </div>

          {/* Preview */}
          {formData.welcomeMessage && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="p-3 bg-muted rounded-md text-sm">
                <p className="font-medium">Message Preview:</p>
                <p className="mt-1">{previewMessage}</p>
                <p className="mt-2 text-muted-foreground">
                  <em>Note: "Text STOP to unsubscribe" will be automatically appended</em>
                </p>
              </div>
            </div>
          )}

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          {/* Instructions */}
          <Alert>
            <AlertDescription>
              <strong>Instructions for customers:</strong><br />
              Text <code className="bg-muted px-1 rounded">{formData.keyword || "KEYWORD"}</code> to your phone number to opt-in.
            </AlertDescription>
          </Alert>

          {/* Form Actions */}
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : keyword ? "Update Keyword" : "Create Keyword"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 