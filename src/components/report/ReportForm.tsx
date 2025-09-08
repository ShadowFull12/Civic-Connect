
"use client";

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { autoRouteIssueToDepartment } from '@/ai/flows/auto-route-issues-to-department';
import { suggestIssueCategory } from '@/ai/flows/suggest-issue-category';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Mic, MapPin, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const issueSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  location: z.object({
      lat: z.number(),
      lng: z.number(),
      address: z.string().min(1, 'Please provide your location.'),
  }),
  photo: z.any().refine(files => files?.length === 1, 'A photo is required.'),
});

type IssueFormValues = z.infer<typeof issueSchema>;


const issueCategories = [
  'Pothole',
  'Streetlight Outage',
  'Garbage Overflow',
  'Water Leakage',
  'Damaged Public Property',
  'Other'
];

const IMGBB_API_KEY = 'a8e65a8b99f65946fde5447b73356856';


export default function ReportForm() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isSuggestingCategory, setIsSuggestingCategory] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const form = useForm<IssueFormValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      category: '',
      description: '',
      location: {
        lat: 0,
        lng: 0,
        address: ''
      },
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
    if (!('geolocation' in navigator)) {
      toast({ title: 'Not Supported', description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
      return;
    }
    
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const address = `Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`;
        
        form.setValue('location', { lat: latitude, lng: longitude, address: address }, { shouldValidate: true });
        toast({ title: 'Location Filled', description: 'Your current location has been set.' });
        setIsFetchingLocation(false);
      },
      (error) => {
        setIsFetchingLocation(false);
        toast({ title: 'Location Denied', description: 'Could not get your location. Please enable location services.', variant: 'destructive' });
      }
    );
  };
  
  const handleSuggestCategory = async () => {
    const description = form.getValues('description');
    if (!description || description.length < 10) {
      form.setError('description', { type: 'manual', message: 'Please enter a description of at least 10 characters to suggest a category.' });
      return;
    }
    
    setIsSuggestingCategory(true);
    try {
      const result = await suggestIssueCategory({ description });
      if (result.category && issueCategories.includes(result.category)) {
        form.setValue('category', result.category, { shouldValidate: true });
        toast({ title: 'Category Suggested', description: `We've selected the "${result.category}" category for you.` });
      } else {
        throw new Error('AI returned an invalid category.');
      }
    } catch (error) {
      console.error("AI category suggestion failed:", error);
      toast({ title: 'Suggestion Failed', description: 'Could not suggest a category. Please select one manually.', variant: 'destructive' });
    } finally {
      setIsSuggestingCategory(false);
    }
  };

  const uploadPhotoToImgBB = async (photoFile: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', photoFile);

    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message || 'Image upload failed');
        }

        const data = await response.json();
        if (data.success && data.data.url) {
            return data.data.url;
        } else {
            throw new Error('Image upload failed, unexpected response from ImgBB');
        }
    } catch (error) {
        console.error("ImgBB upload error:", error);
        toast({ title: 'Upload Failed', description: 'Could not upload the photo. Please try again.', variant: 'destructive' });
        return null;
    }
};

  const onSubmit = async (values: IssueFormValues) => {
    if (!user || !userProfile) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to report an issue.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);

    try {
      toast({ title: 'Processing...', description: 'Uploading your photo.' });
      const photoFile = values.photo[0];
      const photoUrl = await uploadPhotoToImgBB(photoFile);
      if (!photoUrl) {
          throw new Error("Photo upload failed");
      }
      
      const newIssue = {
        userId: user.uid,
        userName: userProfile.name || 'Anonymous',
        category: values.category,
        description: values.description,
        photoUrl,
        location: values.location,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      toast({ title: 'Processing...', description: 'Saving your report.' });
      const docRef = await addDoc(collection(db, 'issues'), newIssue);
      
      toast({ title: 'Success!', description: 'Your issue has been reported.' });

      autoRouteIssueToDepartment({
        category: newIssue.category,
        description: newIssue.description,
        location: newIssue.location
      }).then(routingResponse => {
        console.log("AI Routing successful:", routingResponse);
      }).catch(aiError => {
        console.error("AI routing failed:", aiError);
      });
      
      router.push('/dashboard/my-reports');

    } catch (error) {
      console.error("Submission Failed:", error);
      toast({ 
          title: 'Submission Failed', 
          description: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.', 
          variant: 'destructive' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isReadyToSubmit = !!user && !!userProfile;
  const photoRef = form.register("photo");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
                <div className="flex gap-2">
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isSubmitting || !isReadyToSubmit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an issue category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {issueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                   <Button type="button" variant="outline" onClick={handleSuggestCategory} disabled={isSubmitting || isSuggestingCategory || !isReadyToSubmit}>
                    {isSuggestingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    <span className="sr-only sm:not-sr-only sm:ml-2">Suggest</span>
                  </Button>
                </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location.address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input 
                      placeholder="Click the pin to get your current location" 
                      {...field}
                      readOnly
                      disabled={isSubmitting || isFetchingLocation || !isReadyToSubmit} 
                    />
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
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <FormControl>
                 <Input
                    type="file"
                    accept="image/*"
                    disabled={isSubmitting || !isReadyToSubmit}
                    {...photoRef}
                  />
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
                <AlertTitle>Initializing</AlertTitle>
                <AlertDescription>Please wait, preparing the form...</AlertDescription>
            </Alert>
        )}
      </form>
    </Form>
  );
}
