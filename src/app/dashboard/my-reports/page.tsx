
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { Issue } from '@/lib/types';
import { format } from 'date-fns';
import Image from 'next/image';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, FileText, Trash2, ShieldAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';


export default function MyReportsPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'issues'), 
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const userIssues: Issue[] = [];
      querySnapshot.forEach((doc) => {
        userIssues.push({ id: doc.id, ...doc.data() } as Issue);
      });
      // Sort issues by creation date, descending
      userIssues.sort((a, b) => {
        const dateA = a.createdAt?.toDate() ?? new Date(0);
        const dateB = b.createdAt?.toDate() ?? new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setIssues(userIssues);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching reports: ", error);
        toast({
            title: "Error",
            description: "Could not fetch your reports. Please try again later.",
            variant: "destructive",
        });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleDelete = async (issueId: string) => {
    setIsDeleting(issueId);
    try {
      await deleteDoc(doc(db, "issues", issueId));
      toast({
        title: "Report Deleted",
        description: "Your issue report has been successfully deleted.",
      });
    } catch (error) {
      console.error("Error deleting document: ", error);
      toast({
        title: "Error",
        description: "Failed to delete the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };
  
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
                <Card key={issue.id} className="overflow-hidden flex flex-col group relative">
                   {issue.id && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 z-10 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                              disabled={isDeleting === issue.id}
                            >
                              {isDeleting === issue.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <div className="flex justify-center mb-4">
                                <ShieldAlert className="h-12 w-12 text-destructive"/>
                            </div>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete your report
                              from our servers.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => issue.id && handleDelete(issue.id)}>
                              Yes, delete it
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  )}
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
                      Location: {issue.location.address}
                    </p>
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      {issue.createdAt ? format(issue.createdAt.toDate(), 'PPP') : 'Date not available'}
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
