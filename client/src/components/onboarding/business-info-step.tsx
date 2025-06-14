import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BusinessInfoData {
  businessName?: string;
}

interface Props {
  data: BusinessInfoData;
  onChange: (data: BusinessInfoData) => void;
}

export default function BusinessInfoStep({ data, onChange }: Props) {
  const [name, setName] = useState(data.businessName || "");

  useEffect(() => {
    onChange({ businessName: name });
  }, [name, onChange]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Business Information</h2>
      <p className="text-sm text-muted-foreground">
        Tell us about your business to personalize your experience.
      </p>
      <div>
        <Label htmlFor="businessName">Business Name</Label>
        <Input
          id="businessName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your business"
        />
      </div>
    </div>
  );
}
