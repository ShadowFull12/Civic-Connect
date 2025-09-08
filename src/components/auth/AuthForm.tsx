"use client";

import { useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type SignUpValues = z.infer<typeof signUpSchema>;

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});
type SignInValues = z.infer<typeof signInSchema>;

export function AuthForm() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { register: registerSignUp, handleSubmit: handleSignUp, formState: { errors: errorsSignUp } } = useForm<SignUpValues>({ resolver: zodResolver(signUpSchema) });
  const { register: registerSignIn, handleSubmit: handleSignIn, formState: { errors: errorsSignIn } } = useForm<SignInValues>({ resolver: zodResolver(signInSchema) });

  const onSignUp: SubmitHandler<SignUpValues> = async ({ email, password, name }) => {
    setIsLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name,
        email,
        photoURL: userCredential.user.photoURL,
        role: "citizen",
        createdAt: serverTimestamp(),
      });
      toast({ title: "Account created!", description: "You have been successfully signed up." });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSignIn: SubmitHandler<SignInValues> = async ({ email, password }) => {
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Signed In", description: "Welcome back!" });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        role: 'citizen',
        createdAt: serverTimestamp()
      }, { merge: true });

      toast({ title: "Signed In with Google", description: "Welcome!" });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
  };

  return (
    <div className="rounded-lg border bg-card/80 text-card-foreground shadow-xl backdrop-blur-sm">
      <div className="flex border-b">
        <button
          onClick={() => setIsSignUp(false)}
          className={`flex-1 p-4 text-center font-medium transition-colors ${!isSignUp ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setIsSignUp(true)}
          className={`flex-1 p-4 text-center font-medium transition-colors ${isSignUp ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
        >
          Sign Up
        </button>
      </div>
      <div className="p-6">
        <AnimatePresence mode="wait">
          {isSignUp ? (
            <motion.form key="signup" variants={formVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleSignUp(onSignUp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name-signup">Name</Label>
                <Input id="name-signup" placeholder="John Doe" {...registerSignUp("name")} />
                {errorsSignUp.name && <p className="text-sm text-destructive">{errorsSignUp.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-signup">Email</Label>
                <Input id="email-signup" type="email" placeholder="m@example.com" {...registerSignUp("email")} />
                {errorsSignUp.email && <p className="text-sm text-destructive">{errorsSignUp.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signup">Password</Label>
                <Input id="password-signup" type="password" {...registerSignUp("password")} />
                {errorsSignUp.password && <p className="text-sm text-destructive">{errorsSignUp.password.message}</p>}
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </motion.form>
          ) : (
            <motion.form key="signin" variants={formVariants} initial="hidden" animate="visible" exit="exit" onSubmit={handleSignIn(onSignIn)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-signin">Email</Label>
                <Input id="email-signin" type="email" placeholder="m@example.com" {...registerSignIn("email")} />
                {errorsSignIn.email && <p className="text-sm text-destructive">{errorsSignIn.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signin">Password</Label>
                <Input id="password-signin" type="password" {...registerSignIn("password")} />
                {errorsSignIn.password && <p className="text-sm text-destructive">{errorsSignIn.password.message}</p>}
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </motion.form>
          )}
        </AnimatePresence>

        {error && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <svg role="img" viewBox="0 0 24 24" className="mr-2 h-4 w-4"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.08-2.62 1.62-4.55 1.62-3.87 0-7-3.13-7-7s3.13-7 7-7c1.93 0 3.38.71 4.36 1.62l2.31-2.31C18.25 1.19 15.98 0 12.48 0 5.88 0 .48 5.39.48 12s5.4 12 12 12c3.23 0 5.64-1.12 7.55-3.01 2.03-2.01 2.62-5.06 2.62-8.32 0-.74-.06-1.25-.16-1.75l-9.83-.01z"></path></svg>}
          Google
        </Button>
      </div>
    </div>
  );
}
