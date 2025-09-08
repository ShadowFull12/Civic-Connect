"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import type { Issue } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText } from 'lucide-react';

export default function MyReportsPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'issues'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userIssues: Issue[] = [];
      querySnapshot.forEach((doc) => {
        userIssues.push({ id: doc.id, ...doc.data() } as Issue);
      });
      setIssues(userIssues);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);
  
  const getStatusVariant = (status: Issue['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'resolved': return 'default';
      case 'in-progress': return 'secondary';
      case 'acknowledged': return 'outline';
      case 'pending': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Card>
        <CardHeader>
          <CardTitle>My Reported Issues</CardTitle>
          <CardDescription>Here's a list of all the issues you've reported.</CardDescription>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>No Reports Yet</AlertTitle>
              <AlertDescription>You haven't reported any issues. Once you do, they will appear here.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {issues.map(issue => (
                <Card key={issue.id} className="overflow-hidden flex flex-col">
                  <div className="relative h-48 w-full">
                    <Image
                      src={issue.photoUrl}
                      alt={issue.category}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <CardHeader>
                    <CardTitle>{issue.category}</CardTitle>
                    <CardDescription>{issue.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow">
                    <p className="text-sm text-muted-foreground">
                      Location: {issue.location.lat.toFixed(4)}, {issue.location.lng.toFixed(4)}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {format(issue.createdAt.toDate(), 'PPP')}
                    </p>
                    <Badge variant={getStatusVariant(issue.status)} className="capitalize">{issue.status}</Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
