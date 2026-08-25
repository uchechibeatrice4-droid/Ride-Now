import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  rides: any[] = [];
  driver: any = null;

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) {}

  ngOnInit() {
    this.loadRideRequests();
  }

  loadRideRequests() {
    this.firestore
      .collection('rides', ref =>
        ref.where('status', '==', 'requested')
      )
      .valueChanges({ idField: 'id' })
      .subscribe(data => {
        this.rides = data;
      });
  }

  acceptRide(ride: any) {
    this.fireAuth.currentUser.then(user => {

      if (!user) {
        alert('Please login first.');
        return;
      }

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({
          status: 'accepted',
          driverId: user.uid
        })
        .then(() => {
          alert('Ride accepted successfully! 🚗');

          this.loadRideRequests();
        })
        .catch(error => {
          console.error('Error accepting ride:', error);
          alert('Could not accept the ride.');
        });

    });
  }

}