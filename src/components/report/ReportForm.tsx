"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { Progress } from '@/components/ui/progress';
import { Loader2, Mic, MapPin, Image as ImageIcon } from 'lucide-react';

const issueSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      description: '',
    },
  });

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        () => {
          setLocationError('Could not get your location. Please enable location services.');
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
    }
    
    // Speech Recognition setup
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

  const onSubmit = async (values: z.infer<typeof issueSchema>) => {
    if (!user || !userProfile || !location) {
      toast({ title: 'Error', description: 'You must be logged in and have location enabled.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const photoFile = values.photo[0];
      const storageRef = ref(storage, `issues/${user.uid}/${Date.now()}_${photoFile.name}`);
      const uploadTask = await uploadBytes(storageRef, photoFile, {
        onProgress: (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
      });
      const photoUrl = await getDownloadURL(uploadTask.ref);

      const newIssue = {
        userId: user.uid,
        userName: userProfile.name || 'Anonymous',
        category: values.category,
        description: values.description,
        photoUrl,
        location: { ...location, address: 'Fetching address...' }, // Placeholder address
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'issues'), newIssue);
      
      // Auto-route with GenAI
      try {
        const routingResult = await autoRouteIssueToDepartment({
          category: newIssue.category,
          description: newIssue.description,
          location: { lat: newIssue.location.lat, lng: newIssue.location.lng, address: 'N/A' } // AI doesn't need precise address string
        });
        // You can update the document with the department here
        // await updateDoc(docRef, { assignedDepartment: routingResult.department, reasonForAssignment: routingResult.reason });
      } catch (aiError) {
        console.error("AI routing failed:", aiError);
        // non-blocking, so we continue
      }


      toast({ title: 'Success!', description: 'Your issue has been reported.' });
      router.push('/dashboard/my-reports');
    } catch (error) {
      console.error(error);
      toast({ title: 'Submission Failed', description: 'There was an error reporting your issue.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Textarea placeholder="Describe the issue in detail..." {...field} />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={`absolute bottom-2 right-2 h-7 w-7 ${isListening ? 'text-destructive animate-pulse' : ''}`}
                    onClick={handleMicClick}
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
          name="photo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                <Input type="file" accept="image/*" onChange={(e) => field.onChange(e.target.files)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
          <MapPin className="h-5 w-5 text-primary" />
          {location ? 
            <span>Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span> :
            <span className="text-destructive">{locationError || 'Capturing location...'}</span>
          }
        </div>
        {uploadProgress !== null && (
          <div className="space-y-2">
            <Label>Uploading...</Label>
            <Progress value={uploadProgress} />
          </div>
        )}
        <Button type="submit" disabled={isSubmitting || !location} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit Report
        </Button>
      </form>
    </Form>
  );
}
