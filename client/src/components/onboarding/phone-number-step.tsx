import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TwilioNumber {
  sid: string;
  phoneNumber: string;
  friendlyName?: string;
}

interface Props {
  onSuccess: () => void;
}

export default function PhoneNumberStep({ onSuccess }: Props) {
  const { toast } = useToast();
  const [numbers, setNumbers] = useState<TwilioNumber[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [defaultSid, setDefaultSid] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest({ method: "GET", url: "/api/twilio/numbers" });
      const data: TwilioNumber[] = await res.json();
      setNumbers(data);
      if (data.length === 1) {
        setSelected({ [data[0].sid]: true });
        setDefaultSid(data[0].sid);
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to fetch numbers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNumbers();
  }, []);

  const toggle = (sid: string) =>
    setSelected((prev) => ({ ...prev, [sid]: !prev[sid] }));

  const save = async () => {
    setLoading(true);
    try {
      await apiRequest({
        method: "POST",
        url: "/api/twilio/numbers",
        data: {
          defaultSid,
          sids: Object.keys(selected).filter((k) => selected[k]),
        },
      });
      toast({ title: "Success", description: "Phone numbers saved" });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save numbers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!loading && numbers.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Choose a Phone Number</h2>
        <p className="text-sm">No phone numbers found in your Twilio account.</p>
        <Button onClick={fetchNumbers}>Refresh</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Choose a Phone Number</h2>
      <p className="text-sm text-muted-foreground">
        Select the number customers will see when you message them.
      </p>
      <div className="max-h-64 overflow-y-auto space-y-2">
        <RadioGroup value={defaultSid} onValueChange={setDefaultSid}>
          {numbers.map((num) => (
            <div key={num.sid} className="flex items-center gap-2">
              <RadioGroupItem
                value={num.sid}
                onClick={() => setSelected((s) => ({ ...s, [num.sid]: true }))}
              />
              <Checkbox
                checked={!!selected[num.sid]}
                onCheckedChange={() => toggle(num.sid)}
              />
              <span className="ml-2">{num.phoneNumber}</span>
              {num.friendlyName && (
                <span className="text-xs text-muted-foreground ml-1">
                  {num.friendlyName}
                </span>
              )}
            </div>
          ))}
        </RadioGroup>
      </div>
      <Button
        onClick={save}
        disabled={
          loading ||
          !defaultSid ||
          Object.keys(selected).filter((k) => selected[k]).length === 0
        }
      >
        {loading ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
