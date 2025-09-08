import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg text-center">
        <CardHeader>
            <div className="flex justify-center mb-4">
                <ShieldAlert className="h-12 w-12 text-primary"/>
            </div>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>
            This section is under construction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            The admin dashboard will provide tools for issue management, analytics, and user administration. This feature is coming soon!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
