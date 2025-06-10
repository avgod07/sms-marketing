import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MessagePreviewProps {
  message: string;
}

export default function MessagePreview({ message }: MessagePreviewProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">SMS Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md bg-gray-50 p-4 whitespace-pre-wrap text-sm text-gray-900 min-h-[120px]">
          {message ? message : <span className="text-gray-400">Your message will appear here...</span>}
        </div>
      </CardContent>
    </Card>
  );
}
