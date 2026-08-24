import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';

interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: 'rider' | 'driver' | 'admin';
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(private fireAuth: AngularFireAuth, private firestore: AngularFirestore) { }

  register(
    email: string,
    password: string,
    fullName: string,
    role: 'rider' | 'driver'
  ) {
    return this.fireAuth
      .createUserWithEmailAndPassword(email, password)
      .then(result => {

        const uid = result.user?.uid;

        if (!uid) {
          throw new Error('User ID was not created.');
        }

        return this.firestore.collection('users').doc(uid).set({
          uid: uid,
          fullName: fullName,
          email: email,
          role: role,
          isActive: true
        });
      });
  }

  login(email: string, password: string) {
    return this.fireAuth.signInWithEmailAndPassword(email, password);
  }

  getUserProfile(uid: string) {
    return this.firestore.collection<UserProfile>('users').doc<UserProfile>(uid).valueChanges();
  }

  logout() {
    return this.fireAuth.signOut();
  }
}