import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from '../../core/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

  currentRide: any = null;
  loadingRide: boolean = true;

  // Driver information
  driver: any = null;
  loadingDriver: boolean = false;

  private rideSubscription?: Subscription;
  private driverSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth
  ) { }

  ngOnInit(): void {
    this.loadCurrentRide();
  }

  ngOnDestroy(): void {
    this.rideSubscription?.unsubscribe();
    this.driverSubscription?.unsubscribe();
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }

  goToRequestRide(): void {
    this.router.navigate(['/request-ride']);
  }

  goToRideHistory(): void {
    this.router.navigate(['/ride-history']);
  }

  goToMyProfile(): void {
    this.router.navigate(['/profile']);
  }

  private loadCurrentRide(): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.loadingRide = false;
        return;
      }

      this.rideSubscription = this.firestore
        .collection('rides', ref =>
          ref.where('riderId', '==', user.uid)
        )
        .valueChanges({ idField: 'id' })
        .subscribe({
          next: (rides: any[]) => {

            const activeRides = rides.filter(ride =>
              ride.status === 'requested' ||
              ride.status === 'accepted' ||
              ride.status === 'arriving' ||
              ride.status === 'arrived' ||
              ride.status === 'in_progress'
            );

            if (activeRides.length > 0) {

              activeRides.sort((a, b) => {

                const dateA = this.getDateValue(a.createdAt);
                const dateB = this.getDateValue(b.createdAt);

                return dateB - dateA;
              });

              this.currentRide = activeRides[0];

              // Load driver information when a driver
              // has been assigned to the ride.
              if (this.currentRide.driverId) {
                this.loadDriver(this.currentRide.driverId);
              } else {
                this.driver = null;
                this.driverSubscription?.unsubscribe();
                this.driverSubscription = undefined;
              }

            } else {

              this.currentRide = null;
              this.driver = null;

              this.driverSubscription?.unsubscribe();
              this.driverSubscription = undefined;
            }

            this.loadingRide = false;
          },

          error: error => {
            console.error(
              'Error loading current ride:',
              error
            );

            this.loadingRide = false;
          }
        });
    });
  }

  private loadDriver(driverId: string): void {

    if (!driverId) {
      this.driver = null;
      return;
    }

    this.loadingDriver = true;

    this.driverSubscription?.unsubscribe();

    this.driverSubscription = this.firestore
      .collection('users')
      .doc(driverId)
      .valueChanges()
      .subscribe({
        next: (data: any) => {

          this.driver = data;
          this.loadingDriver = false;

        },

        error: error => {

          console.error(
            'Error loading driver information:',
            error
          );

          this.driver = null;
          this.loadingDriver = false;
        }
      });
  }

  private getDateValue(date: any): number {

    if (!date) {
      return 0;
    }

    if (date.toDate) {
      return date.toDate().getTime();
    }

    return new Date(date).getTime();
  }

  getRideStatusTitle(): string {

    if (!this.currentRide) {
      return '';
    }

    switch (this.currentRide.status) {

      case 'requested':
        return 'Finding a driver';

      case 'accepted':
        return 'Driver accepted your ride';

      case 'arriving':
        return 'Driver is on the way';

      case 'arrived':
        return 'Driver has arrived';

      case 'in_progress':
        return 'Ride in progress';

      default:
        return 'Ride status';
    }
  }


  getRideStatusMessage(): string {

    if (!this.currentRide) {
      return '';
    }

    switch (this.currentRide.status) {

      case 'requested':
        return 'We are looking for a driver for your ride.';

      case 'accepted':
        return 'Your driver has accepted the ride and is preparing to pick you up.';

      case 'arriving':
        return 'Your driver is currently heading to your pickup location.';

      case 'arrived':
        return 'Your driver has arrived at your pickup location.';

      case 'in_progress':
        return 'You are currently on your way to your destination.';

      default:
        return '';
    }
  }

}