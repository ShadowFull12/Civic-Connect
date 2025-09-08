"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, storage } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { autoRouteIssueToDepartment } from '@/ai/flows/auto-route-issues-to-department';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Mic, MapPin } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const issueSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location: z.string().min(5, 'Please enter a location or address.'),
  photo: z.any().refine(file => file?.length == 1, 'Photo is required.'),
});

const issueCategories = [
  'Pothole',
  'Streetlight Outage',
  'Garbage Overflow',
  'Water Leakage',
  'Damaged Public Property',
  'Other'
];

export default function ReportForm() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      category: '',
      description: '',
      location: '',
      photo: undefined,
    },
  });

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        form.setValue('description', form.getValues('description') + transcript);
        setIsListening(false);
      };
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        toast({ title: 'Voice Error', description: `Could not recognize voice: ${event.error}`, variant: 'destructive'});
        setIsListening(false);
      };
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [form, toast]);

  const handleMicClick = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } else {
      toast({ title: 'Not Supported', description: 'Voice input is not supported in your browser.', variant: 'destructive' });
    }
  };
  
  const handleAutoFillLocation = () => {
    if ('geolocation' in navigator) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, you would use a geocoding service here to convert lat/lng to an address.
          // For this prototype, we will just use the coordinates.
          const locationString = `${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
          form.setValue('location', `Near ${locationString}`);
          setIsFetchingLocation(false);
          toast({ title: 'Location Filled', description: 'Your approximate location has been filled.' });
        },
        () => {
          setIsFetchingLocation(false);
          toast({ title: 'Location Error', description: 'Could not get your location. Please enable location services or enter it manually.', variant: 'destructive' });
        }
      );
    } else {
      toast({ title: 'Not Supported', description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
    }
  };

  const onSubmit = async (values: z.infer<typeof issueSchema>) => {
    if (!user || !userProfile) {
      toast({ title: 'Error', description: 'You must be logged in to report an issue.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);

    try {
      const photoFile = values.photo[0];
      const storageRef = ref(storage, `issues/${user.uid}/${Date.now()}_${photoFile.name}`);
      
      await uploadBytes(storageRef, photoFile);
      const photoUrl = await getDownloadURL(storageRef);
      
      // We will use placeholder lat/lng. A real app should geocode the address.
      const placeholderLocation = { lat: 0, lng: 0 };

      const newIssue = {
        userId: user.uid,
        userName: userProfile.name || 'Anonymous',
        category: values.category,
        description: values.description,
        photoUrl,
        location: { ...placeholderLocation, address: values.location },
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'issues'), newIssue);
      
      autoRouteIssueToDepartment({
        category: newIssue.category,
        description: newIssue.description,
        location: { ...placeholderLocation, address: values.location }
      }).catch(aiError => {
        console.error("AI routing failed:", aiError);
      });

      toast({ title: 'Success!', description: 'Your issue has been reported.' });
      router.push('/dashboard/my-reports');
    } catch (error) {
      console.error(error);
      toast({ title: 'Submission Failed', description: 'There was an error reporting your issue.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isReadyToSubmit = !!user && !!userProfile;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an issue category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {issueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <div className="relative">
                  <Textarea placeholder="Describe the issue in detail..." {...field} disabled={isSubmitting} />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`absolute bottom-2 right-2 h-7 w-7 ${isListening ? 'text-destructive animate-pulse' : ''}`}
                    onClick={handleMicClick}
                    disabled={isSubmitting}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input placeholder="Enter address or cross-streets" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <Button type="button" variant="outline" size="icon" onClick={handleAutoFillLocation} disabled={isSubmitting || isFetchingLocation}>
                    {isFetchingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                    <span className="sr-only">Auto-fill location</span>
                  </Button>
                </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files)} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={!isReadyToSubmit || isSubmitting} className="w-full">
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
          ) : (
            'Submit Report'
          )}
        </Button>
        
        {!isReadyToSubmit && (
             <Alert variant="destructive">
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Verifying User</AlertTitle>
                <AlertDescription>Please wait while we verify your information. The submit button will be enabled shortly.</AlertDescription>
            </Alert>
        )}
      </form>
    </Form>
  );
}
