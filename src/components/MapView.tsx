
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Map, { Marker, Popup, NavigationControl, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, Timestamp } from 'firebase/firestore';
import type { Issue } from '@/lib/types';
import { Layers, AlertCircle, Loader2, Pin, Maximize } from 'lucide-react';
import { Badge } from './ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import Image from 'next/image';
import useSupercluster from 'use-supercluster';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from './ui/button';

interface MapViewProps {
  apiKey: string;
}

const categoryColors: { [key: string]: string } = {
  'Pothole': 'hsl(0, 70%, 60%)',
  'Streetlight Outage': 'hsl(50, 100%, 50%)',
  'Garbage Overflow': 'hsl(120, 40%, 50%)',
  'Water Leakage': 'hsl(200, 80%, 60%)',
  'Damaged Public Property': 'hsl(280, 50%, 60%)',
  'Other': 'hsl(0, 0%, 70%)',
};

const getStatusColorClass = (status: Issue['status']) => {
  switch (status) {
    case 'pending': return 'bg-red-500';
    case 'acknowledged': return 'bg-yellow-500';
    case 'in-progress': return 'bg-blue-500';
    case 'resolved': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

export default function MapView({ apiKey }: MapViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [currentUserPosition, setCurrentUserPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [bounds, setBounds] = useState<[number, number, number, number] | undefined>(undefined);
  const [zoom, setZoom] = useState(16);
  const mapRef = useRef<MapRef>(null);
  const isMobile = useIsMobile();

  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 12,
  });

  useEffect(() => {
    let watchId: number;
    if (navigator.geolocation) {
       watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newPosition = { latitude, longitude };
          setCurrentUserPosition(newPosition);

          if (isInitialLoad) {
            setViewState((prev) => ({
              ...prev,
              ...newPosition,
              zoom: isMobile ? 16 : 14,
            }));
            setIsInitialLoad(false);
          }
          setLocationError(null);
        },
        (error) => {
           let errorMessage = "Could not get your location.";
            switch(error.code) {
              case error.PERMISSION_DENIED:
                errorMessage = "Location access denied. Please enable it in your browser settings.";
                console.error("User denied Geolocation.");
                break;
              case error.POSITION_UNAVAILABLE:
                errorMessage = "Location information is unavailable.";
                console.error("Location information is unavailable.");
                break;
              case error.TIMEOUT:
                errorMessage = "The request to get user location timed out.";
                console.error("The request to get user location timed out.");
                break;
              default:
                 console.error("An unknown error occurred while getting location:", error);
                break;
            }
            setLocationError(errorMessage);
            if (isInitialLoad) {
               setIsInitialLoad(false);
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
       setLocationError("Geolocation is not supported by this browser.");
       setIsInitialLoad(false);
    }

    const q = query(collection(db, "issues"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const issuesData: Issue[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.location && data.location.lat != null && data.location.lng != null && data.createdAt) {
          issuesData.push({ id: doc.id, ...data } as Issue);
        }
      });
      setIssues(issuesData);
    });

    return () => {
        unsubscribe();
        if(watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isInitialLoad, isMobile]);

  const points = useMemo(() => issues.map(issue => ({
    type: 'Feature' as const,
    properties: {
      cluster: false,
      issueId: issue.id,
      category: issue.category,
      issue: issue
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [issue.location.lng, issue.location.lat]
    }
  })), [issues]);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 20 },
  });
  
  if (isInitialLoad && !locationError) {
    return (
        <div className="relative h-full w-full flex items-center justify-center bg-card">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 font-semibold">Waiting for location...</p>
        </div>
    )
  }
  
  const handlePinClick = (issue: Issue) => {
    setSelectedIssue(issue);
    mapRef.current?.flyTo({
      center: [issue.location.lng, issue.location.lat],
      zoom: Math.max(16, zoom), // Zoom in if current zoom is too far out
      speed: 1.2,
    });
  };

  return (
    <div className="relative h-full w-full">
        {locationError && (
            <div className="absolute top-2 left-2 z-10 bg-destructive/90 border border-destructive text-destructive-foreground text-xs rounded p-2 shadow-lg">
                {locationError}
            </div>
        )}
        <Map
            {...viewState}
            ref={mapRef}
            onMove={evt => {
                setViewState(evt.viewState);
                if (evt.viewState.zoom !== zoom) setZoom(evt.viewState.zoom);
                const newBounds = evt.target.getBounds().toArray().flat() as [number, number, number, number];
                if (JSON.stringify(newBounds) !== JSON.stringify(bounds)) setBounds(newBounds);
            }}
            onLoad={evt => {
                const newBounds = evt.target.getBounds().toArray().flat() as [number, number, number, number];
                setBounds(newBounds);
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={`https://api.maptiler.com/maps/dataviz-dark/style.json?key=${apiKey}`}
            minZoom={3}
        >
            <NavigationControl position="top-right" />

            {clusters.map(cluster => {
              const [longitude, latitude] = cluster.geometry.coordinates;
              const {
                cluster: isCluster,
                point_count: pointCount,
              } = cluster.properties;

              if (isCluster) {
                return (
                  <Marker
                    key={`cluster-${cluster.id}`}
                    latitude={latitude}
                    longitude={longitude}
                  >
                    <div
                      className="w-8 h-8 md:w-10 md:h-10 bg-primary/80 border-2 border-primary-foreground/50 rounded-full flex items-center justify-center font-bold text-primary-foreground cursor-pointer transition-transform hover:scale-110 shadow-lg"
                      onClick={() => {
                        const expansionZoom = Math.min(
                          supercluster.getClusterExpansionZoom(cluster.id as number),
                          20
                        );
                        mapRef.current?.flyTo({
                          center: [longitude, latitude],
                          zoom: expansionZoom,
                          speed: 1.2,
                        });
                      }}
                    >
                      {pointCount}
                    </div>
                  </Marker>
                );
              }

              const issue = cluster.properties.issue as Issue;

              return (
                <Marker
                    key={`issue-${issue.id}`}
                    latitude={latitude}
                    longitude={longitude}
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        handlePinClick(issue);
                    }}
                >
                    <div className="flex flex-col items-center cursor-pointer group">
                        <div className="relative w-10 h-10 rounded-full border-2 overflow-hidden shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-2xl" style={{borderColor: categoryColors[issue.category] || 'white'}}>
                            <Image src={issue.photoUrl} alt={issue.category} fill className="object-cover"/>
                             <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                        </div>
                        <div className="w-0.5 h-4 bg-muted-foreground/70"></div>
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/70 -mt-1"></div>
                    </div>
                </Marker>
              );
            })}

            {currentUserPosition && (
                <Marker
                    longitude={currentUserPosition.longitude}
                    latitude={currentUserPosition.latitude}
                >
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-400 border-2 border-white shadow-md animate-pulse" />
                </Marker>
            )}

            {selectedIssue && (
                <Popup
                longitude={selectedIssue.location.lng}
                latitude={selectedIssue.location.lat}
                onClose={() => setSelectedIssue(null)}
                closeOnClick={true}
                anchor="left"
                offset={20}
                className="font-body z-20"
                >
                <div 
                  className="bg-card text-card-foreground rounded-lg overflow-hidden shadow-2xl border border-border origin-left transition-transform duration-300 w-64"
                  style={{ transform: `scale(${Math.max(0.5, Math.min(1, zoom / 12))})`}}
                >
                    <Dialog>
                       <DialogTrigger asChild>
                           <div className="relative w-full h-32 cursor-pointer group">
                                <Image src={selectedIssue.photoUrl} alt={selectedIssue.category} fill className="object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize className="h-8 w-8 text-white" />
                                </div>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="p-0 border-0 max-w-4xl">
                            <Image src={selectedIssue.photoUrl} alt={selectedIssue.category} width={1024} height={768} className="w-full h-auto object-contain rounded-lg"/>
                        </DialogContent>
                    </Dialog>
                    <div className="p-3">
                        <h3 className="font-bold font-headline text-lg mb-1" style={{color: categoryColors[selectedIssue.category]}}>{selectedIssue.category}</h3>
                        <p className="text-sm mb-2 text-muted-foreground">{selectedIssue.description}</p>
                        <div className="text-xs text-muted-foreground/80 mb-3 space-y-0.5">
                            <p>Reported by: <span className="font-semibold">{selectedIssue.userName}</span></p>
                            <p title={format(selectedIssue.createdAt.toDate(), 'PPP p')}>
                              {formatDistanceToNow(selectedIssue.createdAt.toDate(), { addSuffix: true })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColorClass(selectedIssue.status)}`}></div>
                            <span className="text-sm capitalize font-medium">{selectedIssue.status}</span>
                        </div>
                    </div>
                </div>
                </Popup>
            )}

            {issues.length === 0 && !isInitialLoad &&(
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                    <div className="bg-background/80 p-4 rounded-lg shadow-lg flex items-center gap-2">
                        <Layers className="h-5 w-5 text-muted-foreground"/>
                        <p className="text-muted-foreground">No issues reported yet. Be the first!</p>
                    </div>
                </div>
            )}
        </Map>
    </div>
  );
}

    