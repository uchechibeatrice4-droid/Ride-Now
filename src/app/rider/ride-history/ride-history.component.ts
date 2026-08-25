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
  activeRide: any = null;

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) { }

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

          // Find the rider's current active ride
          this.activeRide = this.rides.find(ride =>
            ride.status === 'requested' ||
            ride.status === 'accepted' ||
            ride.status === 'arriving' ||
            ride.status === 'in_progress'
          ) || null;

        });

    });
  }

  payForRide(ride: any) {
    if (ride.paymentStatus === 'paid') {
      alert('This ride has already been paid for.');
      return;
    }

    const confirmPayment = confirm(
      `Pay ₦${ride.fare} for this ride?`
    );

    if (!confirmPayment) {
      return;
    }

    this.firestore
      .collection('rides')
      .doc(ride.id)
      .update({
        paymentStatus: 'paid',
        paidAt: new Date()
      })
      .then(() => {
        alert('Payment successful! 🎉');
      })
      .catch(error => {
        console.error('Payment error:', error);
        alert('Payment failed. Please try again.');
      });
  }
}