import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Props {
  onSuccess: () => void;
}

export default function TwilioStep({ onSuccess }: Props) {
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const connect = async () => {
    setLoading(true);
    try {
      await apiRequest({
        method: "POST",
        url: "/api/twilio/connect",
        data: { accountSid: sid, authToken: token },
      });
      toast({ title: "Success", description: "Twilio account connected successfully!" });
      onSuccess();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to connect Twilio account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Connect Your Twilio Account</h2>
      <p className="text-sm text-muted-foreground">
        Enter your Twilio credentials from the Twilio Console.
      </p>
      <div className="space-y-4">
        <div>
          <Label htmlFor="twilio-sid">Twilio Account SID</Label>
          <Input id="twilio-sid" value={sid} onChange={(e) => setSid(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="twilio-token">Twilio Auth Token</Label>
          <Input
            id="twilio-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={connect} disabled={!sid || !token || loading}>
        {loading ? "Connecting..." : "Connect"}
      </Button>
    </div>
  );
}
