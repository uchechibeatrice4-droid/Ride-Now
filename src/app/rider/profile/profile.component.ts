import { Component, OnInit } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {

  profile: any = null;

  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.firestore
        .collection('users')
        .doc(user.uid)
        .valueChanges()
        .subscribe(data => {
          this.profile = data;
        });

    });
  }
}