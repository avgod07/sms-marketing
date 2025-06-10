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
        <div className="rounded-md border bg-gray-50 p-4 min-h-[140px]">
          {message ? (
            <div className="flex justify-end">
              <div className="max-w-[75%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">
                {message}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Your message will appear here...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
