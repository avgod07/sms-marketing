import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface BusinessInfoData {
  businessName?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  addressCountry?: string;
  organizationType?: string;
  companyStatus?: string;
  stockTicker?: string;
  taxId?: string;
  industrySector?: string;
  regionsOfOperation?: string;
  repName?: string;
  repTitle?: string;
  repEmail?: string;
  repPhone?: string;
  useCase?: string;
  campaignDescription?: string;
  sample1?: string;
  sample2?: string;
}

interface Props {
  data: BusinessInfoData;
  onChange: (data: Partial<BusinessInfoData>) => void;
  errors: Partial<Record<keyof BusinessInfoData, string[]>>;
}

export default function BusinessInfoStep({ data, onChange, errors }: Props) {
  const update = (field: keyof BusinessInfoData) => (e: any) =>
    onChange({ [field]: e.target.value });

  useEffect(() => {
    // no-op to satisfy linter for dependencies
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Business Profile</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="businessName">Business Name</Label>
          <Input id="businessName" value={data.businessName || ""} onChange={update("businessName")} />
          {errors.businessName && (
            <p className="text-sm text-red-600 mt-1">{errors.businessName[0]}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="addressStreet">Street</Label>
            <Input id="addressStreet" value={data.addressStreet || ""} onChange={update("addressStreet")} />
            {errors.addressStreet && <p className="text-sm text-red-600 mt-1">{errors.addressStreet[0]}</p>}
          </div>
          <div>
            <Label htmlFor="addressCity">City</Label>
            <Input id="addressCity" value={data.addressCity || ""} onChange={update("addressCity")} />
            {errors.addressCity && <p className="text-sm text-red-600 mt-1">{errors.addressCity[0]}</p>}
          </div>
          <div>
            <Label htmlFor="addressState">State/Province</Label>
            <Input id="addressState" value={data.addressState || ""} onChange={update("addressState")} />
            {errors.addressState && <p className="text-sm text-red-600 mt-1">{errors.addressState[0]}</p>}
          </div>
          <div>
            <Label htmlFor="addressPostalCode">Postal Code</Label>
            <Input id="addressPostalCode" value={data.addressPostalCode || ""} onChange={update("addressPostalCode")} />
            {errors.addressPostalCode && (
              <p className="text-sm text-red-600 mt-1">{errors.addressPostalCode[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="addressCountry">Country</Label>
            <Input id="addressCountry" value={data.addressCountry || ""} onChange={update("addressCountry")} />
            {errors.addressCountry && <p className="text-sm text-red-600 mt-1">{errors.addressCountry[0]}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="organizationType">Organization Type</Label>
            <Input id="organizationType" value={data.organizationType || ""} onChange={update("organizationType")} />
            {errors.organizationType && (
              <p className="text-sm text-red-600 mt-1">{errors.organizationType[0]}</p>
            )}
          </div>
          <div>
            <Label htmlFor="companyStatus">Company Status</Label>
            <Select
              value={data.companyStatus || ""}
              onValueChange={(v) => onChange({ companyStatus: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public</SelectItem>
              </SelectContent>
            </Select>
            {errors.companyStatus && <p className="text-sm text-red-600 mt-1">{errors.companyStatus[0]}</p>}
          </div>
          <div>
            <Label htmlFor="stockTicker">Stock Ticker (if public)</Label>
            <Input id="stockTicker" value={data.stockTicker || ""} onChange={update("stockTicker")} />
            {errors.stockTicker && <p className="text-sm text-red-600 mt-1">{errors.stockTicker[0]}</p>}
          </div>
          <div>
            <Label htmlFor="taxId">Tax/Business ID (EIN)</Label>
            <Input id="taxId" value={data.taxId || ""} onChange={update("taxId")} />
            {errors.taxId && <p className="text-sm text-red-600 mt-1">{errors.taxId[0]}</p>}
            <p className="text-xs text-muted-foreground">Required for compliance</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="industrySector">Industry Sector</Label>
            <Input id="industrySector" value={data.industrySector || ""} onChange={update("industrySector")} />
            {errors.industrySector && <p className="text-sm text-red-600 mt-1">{errors.industrySector[0]}</p>}
          </div>
          <div>
            <Label htmlFor="regionsOfOperation">Regions of Operation</Label>
            <Input id="regionsOfOperation" value={data.regionsOfOperation || ""} onChange={update("regionsOfOperation")} />
            {errors.regionsOfOperation && (
              <p className="text-sm text-red-600 mt-1">{errors.regionsOfOperation[0]}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="repName">Authorized Rep Name</Label>
            <Input id="repName" value={data.repName || ""} onChange={update("repName")} />
            {errors.repName && <p className="text-sm text-red-600 mt-1">{errors.repName[0]}</p>}
          </div>
          <div>
            <Label htmlFor="repTitle">Rep Title/Position</Label>
            <Input id="repTitle" value={data.repTitle || ""} onChange={update("repTitle")} />
            {errors.repTitle && <p className="text-sm text-red-600 mt-1">{errors.repTitle[0]}</p>}
          </div>
          <div>
            <Label htmlFor="repEmail">Rep Email</Label>
            <Input id="repEmail" value={data.repEmail || ""} onChange={update("repEmail")} />
            {errors.repEmail && <p className="text-sm text-red-600 mt-1">{errors.repEmail[0]}</p>}
          </div>
          <div>
            <Label htmlFor="repPhone">Rep Phone</Label>
            <Input id="repPhone" value={data.repPhone || ""} onChange={update("repPhone")} />
            {errors.repPhone && <p className="text-sm text-red-600 mt-1">{errors.repPhone[0]}</p>}
          </div>
        </div>
        <div>
          <Label htmlFor="useCase">Messaging Use Case</Label>
          <Select value={data.useCase || ""} onValueChange={(v) => onChange({ useCase: v })}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="otp">One-time Passwords</SelectItem>
              <SelectItem value="transactional">Transactional Alerts</SelectItem>
            </SelectContent>
          </Select>
          {errors.useCase && <p className="text-sm text-red-600 mt-1">{errors.useCase[0]}</p>}
        </div>
        <div>
          <Label htmlFor="campaignDescription">How will texting be used?</Label>
          <Textarea id="campaignDescription" value={data.campaignDescription || ""} onChange={update("campaignDescription")} rows={3} />
          {errors.campaignDescription && (
            <p className="text-sm text-red-600 mt-1">{errors.campaignDescription[0]}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sample1">Sample Message 1</Label>
            <Textarea id="sample1" value={data.sample1 || ""} onChange={update("sample1")} rows={2} />
            {errors.sample1 && <p className="text-sm text-red-600 mt-1">{errors.sample1[0]}</p>}
          </div>
          <div>
            <Label htmlFor="sample2">Sample Message 2</Label>
            <Textarea id="sample2" value={data.sample2 || ""} onChange={update("sample2")} rows={2} />
            {errors.sample2 && <p className="text-sm text-red-600 mt-1">{errors.sample2[0]}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
