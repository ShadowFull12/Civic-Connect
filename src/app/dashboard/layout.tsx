"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AppSidebar from "@/components/AppSidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset>
            <main className="min-h-screen">
              <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:h-16 sm:px-6">
                <div className="md:hidden">
                  <SidebarTrigger />
                </div>
                <h1 className="text-xl font-semibold font-headline">Civic Connect</h1>
              </header>
              {children}
            </main>
        </SidebarInset>
        <Toaster />
    </SidebarProvider>
  );
}
