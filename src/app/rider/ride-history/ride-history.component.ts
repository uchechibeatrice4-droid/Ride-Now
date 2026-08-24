import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-ride-history',
  templateUrl: './ride-history.component.html',
  styleUrls: ['./ride-history.component.css']
})
export class RideHistoryComponent implements OnInit {

  rides: any[] = [];

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) {}

  ngOnInit() {
    this.loadRides();
  }

  loadRides() {
    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.firestore
        .collection('rides', ref =>
          ref.where('riderId', '==', user.uid)
        )
        .valueChanges({ idField: 'id' })
        .subscribe(data => {
          this.rides = data;
        });

    });
  }
}