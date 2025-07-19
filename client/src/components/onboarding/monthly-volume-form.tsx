import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart3, 
  TrendingUp, 
  Loader2, 
  ArrowRight,
  Info
} from "lucide-react";

export const volumeOptions = [
  "Less than 1K",
  "1K to 10K",
  "10K to 100K",
  "100K to 500K",
  "500K to 1M",
  "More than 1M+",
] as const;

export type VolumeOption = (typeof volumeOptions)[number];

const schema = z.object({
  volume: z.enum(volumeOptions),
});

export interface MonthlyVolumeFormValues {
  volume: VolumeOption;
}

interface MonthlyVolumeFormProps {
  initialValues?: MonthlyVolumeFormValues;
  onSubmit: (data: MonthlyVolumeFormValues) => void;
  onBack?: () => void;
  isSaving?: boolean;
}

export default function MonthlyVolumeForm({
  initialValues,
  onSubmit,
  onBack,
  isSaving = false,
}: MonthlyVolumeFormProps) {
  const form = useForm<MonthlyVolumeFormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      volume: "Less than 1K",
      ...initialValues,
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Compact Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <BarChart3 className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Monthly Volume
          </h3>
          <p className="text-sm text-gray-500">
            Select your expected monthly message volume
          </p>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Volume Selection Section */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <Label className="text-sm font-medium text-gray-700">
              Expected Monthly Volume
            </Label>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">TFV Compliance</span>
            </div>
            <p className="text-sm text-blue-800">
              This information helps ensure compliance with Toll Free Number (TFN) messaging regulations 
              and allows us to configure your account properly.
            </p>
          </div>

          <RadioGroup
            value={form.watch("volume")}
            onValueChange={(val) => form.setValue("volume", val as VolumeOption)}
            className="space-y-3"
          >
            {volumeOptions.map((option, idx) => (
              <label 
                key={option} 
                className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <RadioGroupItem id={`vol-${idx}`} value={option} />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{option}</span>
                  <p className="text-sm text-gray-500 mt-1">
                    {getVolumeDescription(option)}
                  </p>
                </div>
              </label>
            ))}
          </RadioGroup>

          {form.formState.errors.volume && (
            <p className="text-sm text-red-600 flex items-center space-x-1">
              <span className="w-1 h-1 bg-red-600 rounded-full"></span>
              <span>{form.formState.errors.volume.message}</span>
            </p>
          )}
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
              disabled={!form.formState.isValid || isSaving}
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

// Helper function to provide descriptions for volume options
function getVolumeDescription(volume: VolumeOption): string {
  switch (volume) {
    case "Less than 1K":
      return "Perfect for small businesses or testing";
    case "1K to 10K":
      return "Great for growing businesses and regular marketing";
    case "10K to 100K":
      return "Ideal for established businesses with active campaigns";
    case "100K to 500K":
      return "Suitable for large businesses with frequent messaging";
    case "500K to 1M":
      return "For enterprise-level messaging operations";
    case "More than 1M+":
      return "High-volume enterprise messaging requirements";
    default:
      return "";
  }
}
