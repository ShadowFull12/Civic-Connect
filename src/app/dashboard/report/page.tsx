import ReportForm from "@/components/report/ReportForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportPage() {
  return (
    <div className="p-4 sm:p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Report a New Issue</CardTitle>
          <CardDescription>
            Help improve your community by reporting issues. Please provide as much detail as possible.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReportForm />
        </CardContent>
      </Card>
    </div>
  );
}
