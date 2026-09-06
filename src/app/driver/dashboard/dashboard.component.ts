import { Component, OnInit, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from '../../core/auth.service';
import { Subscription } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {

  rides: any[] = [];
  history: any[] = [];

  private allRides: any[] = [];

  private ridesSubscription?: Subscription;
  private driverSubscription?: Subscription;

  driver: any = null;

  // DRIVER STATUS
  isActive: boolean = false;
  isOnline: boolean = false;
  loadingStatus: boolean = false;

  totalEarnings: number = 0;
  todayEarnings: number = 0;
  completedRides: number = 0;

  // CUSTOM MODAL
  modalVisible: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: 'success' | 'error' | 'confirm' = 'success';

  pendingCancelRide: any = null;

  profileForm: FormGroup;

  savingProfile: boolean = false;
  profileEditVisible: boolean = false;

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth,
    private authService: AuthService,
    private fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      name: ['', Validators.required],
      vehicleModel: ['', Validators.required],
      vehicleColor: ['', Validators.required],
      plateNumber: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadDriverStatus();
    this.subscribeToRideUpdates();
  }

  ngOnDestroy(): void {
    this.ridesSubscription?.unsubscribe();
    this.driverSubscription?.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  openProfileEdit(): void {
    this.profileEditVisible = true;
  }

  closeProfileEdit(): void {
    this.profileEditVisible = false;
  }

  openModal(
    title: string,
    message: string,
    type: 'success' | 'error' | 'confirm'
  ): void {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalVisible = true;
  }

  closeModal(): void {
    this.modalVisible = false;
    this.pendingCancelRide = null;
  }

  confirmAction(): void {
    if (
      this.modalType === 'confirm' &&
      this.pendingCancelRide
    ) {
      const ride = this.pendingCancelRide;

      this.modalVisible = false;
      this.pendingCancelRide = null;

      this.performCancelRide(ride);
      return;
    }

    this.closeModal();
  }

  private subscribeToRideUpdates(): void {
    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.ridesSubscription =
        this.firestore
          .collection('rides')
          .valueChanges({ idField: 'id' })
          .subscribe(data => {

            this.allRides = data;

            this.refreshRideLists(user.uid);
          });
    });
  }

  private refreshRideLists(driverId: string): void {

    // Only ACTIVE + ONLINE drivers can see new ride requests
    const requestedRides =
      this.isActive && this.isOnline
        ? this.allRides.filter((ride: any) =>
            ride.status === 'requested'
          )
        : [];

    // Keep already accepted rides visible
    const myActiveRides =
      this.allRides.filter((ride: any) => {

        return ride.driverId === driverId &&
          (
            ride.status === 'accepted' ||
            ride.status === 'arriving' ||
            ride.status === 'arrived' ||
            ride.status === 'in_progress'
          );
      });

    this.rides = [
      ...requestedRides,
      ...myActiveRides
    ];

    // Ride history
    this.history =
      this.allRides.filter((ride: any) => {

        return ride.driverId === driverId &&
          (
            ride.status === 'completed' ||
            ride.status === 'cancelled'
          );
      });

    this.completedRides =
      this.history.filter(
        ride => ride.status === 'completed'
      ).length;

    // Paid completed rides
    const paidCompletedRides =
      this.history.filter(
        ride =>
          ride.status === 'completed' &&
          ride.paymentStatus === 'paid'
      );

    this.totalEarnings =
      paidCompletedRides.reduce(
        (total, ride) =>
          total + Number(ride.fare || 0),
        0
      );

    // Today's earnings
    const today = new Date();

    this.todayEarnings =
      paidCompletedRides
        .filter(ride => {

          if (!ride.completedAt) {
            return false;
          }

          const completedDate =
            ride.completedAt.toDate
              ? ride.completedAt.toDate()
              : new Date(ride.completedAt);

          return (
            completedDate.getDate() === today.getDate() &&
            completedDate.getMonth() === today.getMonth() &&
            completedDate.getFullYear() === today.getFullYear()
          );
        })
        .reduce(
          (total, ride) =>
            total + Number(ride.fare || 0),
          0
        );
  }

  acceptRide(ride: any): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );
        return;
      }

      // ADMIN DEACTIVATED DRIVER
      if (!this.isActive) {
        this.openModal(
          'Account Deactivated',
          'Your driver account has been deactivated by the administrator. You cannot accept rides.',
          'error'
        );
        return;
      }

      // DRIVER OFFLINE
      if (!this.isOnline) {
        this.openModal(
          'You Are Offline',
          'Please go online before accepting a ride.',
          'error'
        );
        return;
      }

      if (ride.status !== 'requested') {
        this.openModal(
          'Ride Not Available',
          'This ride is no longer available.',
          'error'
        );
        return;
      }

      const rideRef =
        this.firestore
          .collection('rides')
          .doc(ride.id)
          .ref;

      const driverRef =
        this.firestore
          .collection('users')
          .doc(user.uid)
          .ref;

      this.firestore.firestore
        .runTransaction(async transaction => {

          // Read driver
          const driverSnapshot =
            await transaction.get(driverRef);

          const driverData =
            driverSnapshot.data() as any;

          // Read ride
          const rideSnapshot =
            await transaction.get(rideRef);

          const currentRide =
            rideSnapshot.data() as any;

          // Verify driver
          if (!driverData) {
            throw new Error(
              'DRIVER_NOT_FOUND'
            );
          }

          if (
            driverData.role !== 'driver' ||
            driverData.isActive !== true
          ) {
            throw new Error(
              'DRIVER_INACTIVE'
            );
          }

          if (driverData.isOnline !== true) {
            throw new Error(
              'DRIVER_OFFLINE'
            );
          }

          // Verify ride
          if (
            !currentRide ||
            currentRide.status !== 'requested'
          ) {
            throw new Error(
              'RIDE_ALREADY_TAKEN'
            );
          }

          // Accept ride
          transaction.update(
            rideRef,
            {
              status: 'accepted',
              driverId: user.uid,
              acceptedAt: new Date()
            }
          );
        })
        .then(() => {

          this.openModal(
            'Ride Accepted',
            'You have successfully accepted the ride.',
            'success'
          );

        })
        .catch(error => {

          console.error(
            'Error accepting ride:',
            error
          );

          if (
            error.message ===
            'DRIVER_INACTIVE'
          ) {
            this.openModal(
              'Account Deactivated',
              'Your driver account has been deactivated by the administrator.',
              'error'
            );
            return;
          }

          if (
            error.message ===
            'DRIVER_OFFLINE'
          ) {
            this.openModal(
              'You Are Offline',
              'Please go online before accepting a ride.',
              'error'
            );
            return;
          }

          if (
            error.message ===
            'RIDE_ALREADY_TAKEN'
          ) {
            this.openModal(
              'Ride Already Taken',
              'Another driver has already accepted this ride.',
              'error'
            );
            return;
          }

          this.openModal(
            'Something Went Wrong',
            'Could not accept this ride.',
            'error'
          );
        });
    });
  }

  updateRideStatus(
    ride: any,
    status: string
  ): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );
        return;
      }

      if (ride.driverId !== user.uid) {
        this.openModal(
          'Access Denied',
          'You cannot update this ride.',
          'error'
        );
        return;
      }

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({
          status: status,

          ...(status === 'completed'
            ? {
                completedAt: new Date()
              }
            : {})
        })
        .then(() => {

          this.openModal(
            'Status Updated',
            `Ride status updated to ${status}.`,
            'success'
          );

        })
        .catch(error => {

          console.error(
            'Error updating ride status:',
            error
          );

          this.openModal(
            'Something Went Wrong',
            'Could not update ride status.',
            'error'
          );
        });
    });
  }

  cancelRide(ride: any): void {

    if (ride.status === 'in_progress') {

      this.openModal(
        'Cannot Cancel Ride',
        'This ride has already started and can no longer be cancelled.',
        'error'
      );

      return;
    }

    this.pendingCancelRide = ride;

    this.openModal(
      'Cancel Ride',
      'Are you sure you want to cancel this ride?',
      'confirm'
    );
  }

  private performCancelRide(ride: any): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );
        return;
      }

      if (ride.driverId !== user.uid) {
        this.openModal(
          'Access Denied',
          'You cannot cancel this ride.',
          'error'
        );
        return;
      }

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({
          status: 'cancelled',
          cancelledBy: 'driver',
          cancelledAt: new Date()
        })
        .then(() => {

          this.openModal(
            'Ride Cancelled',
            'The ride has been cancelled successfully.',
            'success'
          );

        })
        .catch(error => {

          console.error(
            'Error cancelling ride:',
            error
          );

          this.openModal(
            'Something Went Wrong',
            'Could not cancel this ride.',
            'error'
          );
        });
    });
  }

  loadDriverStatus(): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.driverSubscription =
        this.firestore
          .collection('users')
          .doc(user.uid)
          .valueChanges()
          .subscribe((data: any) => {

            if (data) {

              this.driver = data;

              // Check whether admin has activated this driver
              this.isActive =
                data.isActive === true;

              // Driver can only be online when active
              this.isOnline =
                this.isActive &&
                data.isOnline === true;

              this.profileForm.patchValue({
                name: data.name || '',

                vehicleModel:
                  data.vehicleModel || '',

                vehicleColor:
                  data.vehicleColor || '',

                plateNumber:
                  data.plateNumber || ''
              });

              this.refreshRideLists(
                user.uid
              );
            }
          });
    });
  }

  saveDriverProfile(): void {

    if (this.profileForm.invalid) {

      this.profileForm.markAllAsTouched();

      this.openModal(
        'Incomplete Profile',
        'Please fill in all driver and vehicle information.',
        'error'
      );

      return;
    }

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );
        return;
      }

      this.savingProfile = true;

      const profileData = {
        name:
          this.profileForm.value.name,

        vehicleModel:
          this.profileForm.value.vehicleModel,

        vehicleColor:
          this.profileForm.value.vehicleColor,

        plateNumber:
          this.profileForm.value.plateNumber
      };

      this.firestore
        .collection('users')
        .doc(user.uid)
        .update(profileData)
        .then(() => {

          this.savingProfile = false;

          this.openModal(
            'Profile Saved',
            'Your driver and vehicle information has been saved successfully.',
            'success'
          );

        })
        .catch(error => {

          console.error(
            'Error saving driver profile:',
            error
          );

          this.savingProfile = false;
          this.profileEditVisible = false;

          this.openModal(
            'Something Went Wrong',
            'Could not save your profile information.',
            'error'
          );
        });
    });
  }

  toggleOnlineStatus(): void {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );
        return;
      }

      // Driver must be activated by admin
      if (!this.isActive) {
        this.isOnline = false;

        this.openModal(
          'Account Deactivated',
          'Your driver account has been deactivated by the administrator. You cannot go online or accept rides.',
          'error'
        );

        return;
      }

      this.loadingStatus = true;

      const newStatus =
        !this.isOnline;

      this.firestore
        .collection('users')
        .doc(user.uid)
        .update({
          isOnline: newStatus
        })
        .then(() => {

          this.isOnline =
            newStatus;

          this.loadingStatus =
            false;

          this.refreshRideLists(
            user.uid
          );

          this.openModal(
            newStatus
              ? 'You are Online'
              : 'You are Offline',

            newStatus
              ? 'You can now receive ride requests.'
              : 'You will no longer receive new ride requests.',

            'success'
          );

        })
        .catch(error => {

          console.error(
            'Error updating driver status:',
            error
          );

          this.loadingStatus =
            false;

          this.openModal(
            'Something Went Wrong',
            'Could not update your online status.',
            'error'
          );
        });
    });
  }

}