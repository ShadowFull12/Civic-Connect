
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import dynamic from "next/dynamic";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => <div className="h-[calc(100vh-8rem)] w-full animate-pulse rounded-lg bg-muted"></div>,
});


export default function MapPage() {
  const mapTilerApiKey = 'lzZb3ygVJBpZSlkEQ2fv';

  return (
    <div className="p-4 sm:p-6 h-full">
       <div className="grid gap-6 h-full">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Community Issue Map</CardTitle>
            <CardDescription>Click on a pin to see issue details or on a cluster to zoom in.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
             {mapTilerApiKey && mapTilerApiKey !== 'YOUR_MAPTILER_API_KEY' ? (
              <div className="h-full w-full rounded-lg overflow-hidden border shadow-lg">
                <MapView apiKey={mapTilerApiKey} />
              </div>
            ) : (
                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Map Configuration Needed</AlertTitle>
                    <AlertDescription>
                        Please provide a valid MapTiler API key to display the map. You can add your key in the MapView component.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
