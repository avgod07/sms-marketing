import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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

export type MonthlyVolumeFormValues = z.infer<typeof schema>;

interface MonthlyVolumeFormProps {
  initialValues?: MonthlyVolumeFormValues;
  onSubmit: (data: MonthlyVolumeFormValues) => void;
}

export default function MonthlyVolumeForm({
  initialValues,
  onSubmit,
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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-xl mx-auto">
      <div>
        <p className="mb-4 text-gray-700">
          Estimate your expected monthly message volume for A2P compliance.
        </p>
        <RadioGroup
          value={form.watch("volume")}
          onValueChange={(val) => form.setValue("volume", val as VolumeOption)}
          className="grid gap-2"
        >
          {volumeOptions.map((opt, idx) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem id={`vol-${idx}`} value={opt} />
              <Label htmlFor={`vol-${idx}`}>{opt}</Label>
            </div>
          ))}
        </RadioGroup>
        {form.formState.errors.volume && (
          <p className="text-sm text-red-600 mt-1">{form.formState.errors.volume.message}</p>
        )}
      </div>
      <div className="pt-4 text-right">
        <Button type="submit" disabled={!form.formState.isValid}>
          Next
        </Button>
      </div>
    </form>
  );
}
