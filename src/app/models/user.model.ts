export interface User {
    uid: string;
    fullName: string;
    email: string; 
    phone: string;
    role: 'rider' | 'driver' | 'admin';
    photoUrl?: string;
    isActive: boolean;
}