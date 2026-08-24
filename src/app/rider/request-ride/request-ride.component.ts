import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-request-ride',
  templateUrl: './request-ride.component.html',
  styleUrls: ['./request-ride.component.css']
})
export class RequestRideComponent {

  rideForm = this.fb.group({
    pickup: ['', Validators.required],
    destination: ['', Validators.required],
    rideType: ['Standard', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) {}

  requestRide() {
    if (this.rideForm.invalid) {
      return;
    }

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        alert('Please login first.');
        return;
      }

      const rideData = {
        riderId: user.uid,
        pickup: this.rideForm.value.pickup,
        destination: this.rideForm.value.destination,
        rideType: this.rideForm.value.rideType,
        status: 'requested',
        createdAt: new Date()
      };

      this.firestore.collection('rides').add(rideData)
        .then(() => {
          alert('Ride request submitted successfully!');

          this.rideForm.reset({
            pickup: '',
            destination: '',
            rideType: 'Standard'
          });
        })
        .catch(error => {
          console.error('Error creating ride:', error);
          alert('Could not submit ride request.');
        });

    });
  }
}