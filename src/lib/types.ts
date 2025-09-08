import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  role: 'citizen' | 'admin';
  createdAt: Timestamp;
}

export interface Issue {
  id?: string;
  userId: string;
  userName: string;
  category: string;
  description: string;
  photoUrl: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  status: 'pending' | 'acknowledged' | 'in-progress' | 'resolved';
  assignedDepartment?: string;
  reasonForAssignment?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
