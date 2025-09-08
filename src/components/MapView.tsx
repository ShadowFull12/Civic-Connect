"use client";

import { useState, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query } from 'firebase/firestore';
import type { Issue } from '@/lib/types';
import { Pin, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { format } from 'date-fns';

interface MapViewProps {
  apiKey: string;
}

export default function MapView({ apiKey }: MapViewProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [viewState, setViewState] = useState({
    longitude: -74.006,
    latitude: 40.7128,
    zoom: 12,
  });

  useEffect(() => {
    // Get user's current location to center the map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setViewState((prev) => ({
            ...prev,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }));
        },
        () => {
          console.warn("Could not get user location. Defaulting to NYC.");
        }
      );
    }

    const q = query(collection(db, "issues"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const issuesData: Issue[] = [];
      querySnapshot.forEach((doc) => {
        issuesData.push({ id: doc.id, ...doc.data() } as Issue);
      });
      setIssues(issuesData);
    });

    return () => unsubscribe();
  }, []);

  const getStatusColor = (status: Issue['status']) => {
    switch (status) {
      case 'pending': return 'text-red-500';
      case 'acknowledged': return 'text-yellow-500';
      case 'in-progress': return 'text-blue-500';
      case 'resolved': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Map
      {...viewState}
      onMove={evt => setViewState(evt.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={`https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`}
    >
      <NavigationControl position="top-right" />

      {issues.map(issue => (
        <Marker
          key={issue.id}
          longitude={issue.location.lng}
          latitude={issue.location.lat}
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            setSelectedIssue(issue);
          }}
        >
          <Pin className={`h-8 w-8 cursor-pointer ${getStatusColor(issue.status)}`} fill="currentColor" />
        </Marker>
      ))}

      {selectedIssue && (
        <Popup
          longitude={selectedIssue.location.lng}
          latitude={selectedIssue.location.lat}
          onClose={() => setSelectedIssue(null)}
          closeOnClick={false}
          anchor="left"
        >
          <div className="w-64 p-2 font-body">
            <h3 className="font-bold font-headline text-lg mb-2">{selectedIssue.category}</h3>
            {selectedIssue.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedIssue.photoUrl} alt={selectedIssue.category} className="mb-2 rounded-md w-full h-32 object-cover" />
            )}
            <p className="text-sm mb-2">{selectedIssue.description}</p>
            <div className="text-xs text-muted-foreground mb-2">
              <p>Reported by: {selectedIssue.userName}</p>
              <p>{format(selectedIssue.createdAt.toDate(), 'PPP p')}</p>
            </div>
            <Badge 
              variant={selectedIssue.status === 'resolved' ? 'default' : selectedIssue.status === 'pending' ? 'destructive' : 'secondary'}
              className="capitalize"
            >
              {selectedIssue.status}
            </Badge>
          </div>
        </Popup>
      )}

      {issues.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="bg-background/80 p-4 rounded-lg shadow-lg flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-muted-foreground"/>
                  <p className="text-muted-foreground">No issues reported yet. Be the first!</p>
              </div>
          </div>
      )}
    </Map>
  );
}
