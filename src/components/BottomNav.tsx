
"use client";

import Link from "next/link";
import { usePathname } from 'next/navigation';
import { signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, FileText, Map, LogOut, User as UserIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BottomNavProps {
    user: User;
}

export default function BottomNav({ user }: BottomNavProps) {
  const pathname = usePathname();
  const { toast } = useToast();
  const { userProfile } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to log out.", variant: "destructive" });
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const displayName = userProfile?.name || user.displayName || user.email;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/report", label: "Report", icon: FileText },
    { href: "/dashboard/my-reports", label: "My Reports", icon: Map },
  ];

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-background border-t border-border">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
        {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
                 <Link key={item.href} href={item.href} className={`inline-flex flex-col items-center justify-center px-5 hover:bg-muted group ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    <item.icon className="w-6 h-6" />
                    <span className="sr-only">{item.label}</span>
                </Link>
            )
        })}

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <button type="button" className="inline-flex flex-col items-center justify-center px-5 hover:bg-muted group text-muted-foreground">
                    <Avatar className="h-7 w-7">
                        <AvatarImage src={user.photoURL ?? ''} alt={displayName ?? 'User'} />
                        <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                    </Avatar>
                    <span className="sr-only">Profile</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
                 <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={user.photoURL ?? ''} alt={displayName ?? 'User'} />
                            <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="truncate text-left text-sm">
                            <div className="font-medium truncate">{displayName}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>

      </div>
    </div>
  );
}
