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

const MAPTILER_API_KEY = 'lzZb3ygVJBpZSlkEQ2fv';

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
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const response = await fetch(`https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${MAPTILER_API_KEY}`);
            if (!response.ok) throw new Error('Failed to fetch address');
            const data = await response.json();
            if (data.features && data.features.length > 0) {
              form.setValue('location', data.features[0].place_name, { shouldValidate: true });
              toast({ title: 'Location Filled', description: 'Your address has been auto-filled.' });
            } else {
              throw new Error('No address found for coordinates.');
            }
          } catch (error) {
            console.error(error);
            toast({ title: 'Location Error', description: 'Could not fetch address. Please enter it manually.', variant: 'destructive' });
          } finally {
            setIsFetchingLocation(false);
          }
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
  
  const getCoordsFromAddress = async (address: string): Promise<{ lat: number; lng: number }> => {
    try {
        const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_API_KEY}`);
        if (!response.ok) throw new Error('Failed to geocode address');
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const [lng, lat] = data.features[0].center;
            return { lat, lng };
        }
        throw new Error('Could not find coordinates for the address.');
    } catch (error) {
        console.error("Geocoding failed:", error);
        toast({ title: 'Geocoding Error', description: 'Could not find coordinates for the address. Please try a different address.', variant: 'destructive' });
        // Throw error to stop submission
        throw error;
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
      
      const locationCoords = await getCoordsFromAddress(values.location);

      const newIssue = {
        userId: user.uid,
        userName: userProfile.name || 'Anonymous',
        category: values.category,
        description: values.description,
        photoUrl,
        location: { ...locationCoords, address: values.location },
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'issues'), newIssue);
      
      toast({ title: 'Success!', description: 'Your issue has been reported.' });
      
      // AI routing can run in the background without blocking user flow
      autoRouteIssueToDepartment({
        category: newIssue.category,
        description: newIssue.description,
        location: newIssue.location
      }).then(async (routingResponse) => {
        console.log("AI Routing successful:", routingResponse);
        // Optionally update the firestore document with AI routing info
      }).catch(aiError => {
        console.error("AI routing failed:", aiError);
        // Don't bother user with this error, just log it
      });

      router.push('/dashboard/my-reports');
    } catch (error) {
      console.error("Submission Failed:", error);
      toast({ title: 'Submission Failed', description: 'There was an error reporting your issue. Please check your details and try again.', variant: 'destructive' });
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
              <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isSubmitting || !isReadyToSubmit}>
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
                  <Textarea placeholder="Describe the issue in detail..." {...field} disabled={isSubmitting || !isReadyToSubmit} />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`absolute bottom-2 right-2 h-7 w-7 ${isListening ? 'text-destructive animate-pulse' : ''}`}
                    onClick={handleMicClick}
                    disabled={isSubmitting || !isReadyToSubmit}
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
                    <Input placeholder="Enter address or cross-streets" {...field} disabled={isSubmitting || isFetchingLocation || !isReadyToSubmit} />
                  </FormControl>
                  <Button type="button" variant="outline" size="icon" onClick={handleAutoFillLocation} disabled={isSubmitting || isFetchingLocation || !isReadyToSubmit}>
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
          render={({ field: { onChange, value, ...fieldProps } }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files)} disabled={isSubmitting || !isReadyToSubmit} {...fieldProps} />
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
                <AlertTitle>Initializing Form</AlertTitle>
                <AlertDescription>Please wait a moment. The form will be enabled shortly.</AlertDescription>
            </Alert>
        )}
      </form>
    </Form>
  );
}
