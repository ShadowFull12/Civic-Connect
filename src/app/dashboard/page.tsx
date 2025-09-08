
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, Query, DocumentData } from 'firebase/firestore';
import type { Issue, UserProfile } from '@/lib/types';
import Link from 'next/link';
import Image from 'next/image';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Map, Users, CheckCircle, Award, Star, TrendingUp, Target, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const geolib = {
  getDistance: (
    start: { latitude: number; longitude: number },
    end: { latitude: number; longitude: number }
  ): number => {
    const toRad = (value: number) => (value * Math.PI) / 180;

    const R = 6371; // km
    const dLat = toRad(end.latitude - start.latitude);
    const dLon = toRad(end.longitude - start.longitude);
    const lat1 = toRad(start.latitude);
    const lat2 = toRad(end.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  },
};

const getStarBadge = (reportCount: number): React.ReactNode => {
    const starCount = Math.floor(reportCount / 10);
    if (starCount === 0) return null;
    const clampedStarCount = Math.min(starCount, 5);
    return (
        <div className="flex items-center gap-1 text-yellow-400">
            <Star className="h-4 w-4 fill-current" />
            <span className="font-bold">{clampedStarCount}</span>
        </div>
    );
};

export default function DashboardPage() {
    const { user, userProfile } = useAuth();
    const [localIssues, setLocalIssues] = useState<Issue[]>([]);
    const [leaderboard, setLeaderboard] = useState<{ userId: string; name: string; photoURL: string; count: number }[]>([]);
    const [userPosition, setUserPosition] = useState<{ latitude: number, longitude: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserPosition({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                setError(null);
            },
            (err) => {
                setError(`Could not get your location: ${err.message}. Some features may be unavailable.`);
                setLoading(false);
            }
        );
    }, []);

    useEffect(() => {
        if (!userPosition) return;

        const issuesQuery = query(collection(db, 'issues'));
        const usersQuery = query(collection(db, 'users'));

        const unsubscribeIssues = onSnapshot(issuesQuery, (snapshot) => {
            const allIssues: Issue[] = [];
            snapshot.forEach(doc => allIssues.push({ id: doc.id, ...doc.data() } as Issue));

            const nearbyIssues = allIssues.filter(issue => {
                const distance = geolib.getDistance(
                    { latitude: userPosition.latitude, longitude: userPosition.longitude },
                    { latitude: issue.location.lat, longitude: issue.location.lng }
                );
                return distance <= 20; // 20 km radius
            });
            setLocalIssues(nearbyIssues);
            setLoading(false);

        }, (err) => {
            console.error("Error fetching issues:", err);
            setError("Could not load community data. Please refresh the page.");
            setLoading(false);
        });

        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
             const allUsers: { [key: string]: UserProfile } = {};
             snapshot.forEach(doc => {
                 allUsers[doc.id] = doc.data() as UserProfile;
             });

            const issueCounts: { [key: string]: number } = {};
            localIssues.forEach(issue => {
                issueCounts[issue.userId] = (issueCounts[issue.userId] || 0) + 1;
            });

            const leaderboardData = Object.entries(issueCounts)
                .map(([userId, count]) => ({
                    userId,
                    name: allUsers[userId]?.name || 'Anonymous',
                    photoURL: allUsers[userId]?.photoURL || '',
                    count
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10); // Top 10

            setLeaderboard(leaderboardData);

        }, (err) => {
             console.error("Error fetching users:", err);
        });

        return () => {
            unsubscribeIssues();
            unsubscribeUsers();
        };

    }, [userPosition, localIssues]);


    const resolvedIssuesCount = localIssues.filter(issue => issue.status === 'resolved').length;
    const getInitials = (name: string | null | undefined) => {
        if (!name) return "U";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center p-4 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-lg font-semibold text-muted-foreground">Finding your local community...</p>
                <p className="text-sm text-muted-foreground">Please ensure location services are enabled.</p>
            </div>
        );
    }
    
    return (
        <div className="p-4 sm:p-6 space-y-6">
            <Card className="bg-primary/10 border-primary/20">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-2xl font-bold font-headline text-primary">
                        Welcome, {userProfile?.name || user?.email}!
                    </CardTitle>
                    <Avatar className="h-12 w-12 hidden sm:block">
                        <AvatarImage src={userProfile?.photoURL ?? ''} alt={userProfile?.name ?? ''} />
                        <AvatarFallback>{getInitials(userProfile?.name)}</AvatarFallback>
                    </Avatar>
                </CardHeader>
                <CardContent>
                    <p className="text-base text-muted-foreground">
                        Ready to make a difference? View the map or report a new issue.
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-4">
                        <Button asChild className="w-full sm:w-auto">
                            <Link href="/dashboard/report">Report an Issue</Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full sm:w-auto">
                           <Link href="/dashboard/map"><Map className="mr-2 h-4 w-4" /> View Community Map</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {error && (
                 <Alert variant="destructive">
                    <Target className="h-4 w-4" />
                    <AlertTitle>Location Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Local Issues (20km Radius)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{localIssues.length}</div>
                        <p className="text-xs text-muted-foreground">Total issues reported in your area</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Resolved Issues</CardTitle>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{resolvedIssuesCount}</div>
                        <p className="text-xs text-muted-foreground">Of {localIssues.length} total local issues</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Award className="h-6 w-6 text-primary"/>
                        <CardTitle>Local Leaderboard</CardTitle>
                    </div>
                    <CardDescription>Top reporters in your 20km radius. Keep reporting to climb up!</CardDescription>
                </CardHeader>
                <CardContent>
                     {leaderboard.length > 0 ? (
                        <ul className="space-y-4">
                            {leaderboard.map((leader, index) => (
                                <li key={leader.userId} className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-muted/50">
                                    <span className="text-lg font-bold text-muted-foreground w-6 text-center">{index + 1}</span>
                                    <Avatar>
                                        <AvatarImage src={leader.photoURL} alt={leader.name} />
                                        <AvatarFallback>{getInitials(leader.name)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <p className="font-semibold">{leader.name}</p>
                                        <p className="text-sm text-muted-foreground">{leader.count} reports</p>
                                    </div>
                                    {getStarBadge(leader.count)}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center text-muted-foreground py-8">
                            <Users className="mx-auto h-12 w-12" />
                            <p className="mt-4 font-semibold">No reports in your area yet.</p>
                            <p className="text-sm">Be the first to report an issue and appear here!</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
