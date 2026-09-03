import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  rides: any[] = [];
  history: any[] = [];

  driver: any = null;
  isOnline: boolean = false;
  loadingStatus: boolean = false;

  totalEarnings: number = 0;
  todayEarnings: number = 0;
  completedRides: number = 0;

  modalVisible: boolean = false;
  modalTitle: string = '';
  modalMessage: string = '';
  modalType: 'success' | 'error' | 'confirm' = 'success';

  constructor(
    private firestore: AngularFirestore,
    private fireAuth: AngularFireAuth,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loadRideRequests();
    this.loadDriverStatus();
  }

  // ================================
  // LOGOUT
  // ================================

  logout() {
    this.authService.logout();
  }

  // ================================
  // MODAL
  // ================================

  openModal(
    title: string,
    message: string,
    type: 'success' | 'error' | 'confirm'
  ) {
    this.modalTitle = title;
    this.modalMessage = message;
    this.modalType = type;
    this.modalVisible = true;
  }

  closeModal() {
    this.modalVisible = false;
  }

  confirmAction() {
    this.closeModal();
  }

  // ================================
  // LOAD RIDES
  // ================================

  loadRideRequests() {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.firestore
        .collection('rides')
        .valueChanges({ idField: 'id' })
        .subscribe(data => {

          this.rides = data.filter((ride: any) => {

            return ride.status === 'requested' ||
              (
                ride.driverId === user.uid &&
                (
                  ride.status === 'accepted' ||
                  ride.status === 'arriving' ||
                  ride.status === 'in_progress'
                )
              );

          });

          this.history = data.filter((ride: any) => {

            return ride.driverId === user.uid &&
              (
                ride.status === 'completed' ||
                ride.status === 'cancelled'
              );

          });

          // Completed rides

          this.completedRides = this.history.filter(
            ride => ride.status === 'completed'
          ).length;

          const completedRides = this.history.filter(
            ride => ride.status === 'completed'
          );

          // Total earnings

          this.totalEarnings = completedRides.reduce(
            (total, ride) => {
              return total + Number(ride.fare || 0);
            },
            0
          );

          // Today's earnings

          const today = new Date();

          this.todayEarnings = completedRides
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
              (total, ride) => {
                return total + Number(ride.fare || 0);
              },
              0
            );

        });

    });

  }

  // ================================
  // ACCEPT RIDE
  // ================================

  acceptRide(ride: any) {

    this.fireAuth.currentUser.then(user => {

      if (!user) {

        this.openModal(
          'Login Required',
          'Please login first.',
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

      this.firestore
        .collection('rides')
        .doc(ride.id)
        .update({
          status: 'accepted',
          driverId: user.uid,
          acceptedAt: new Date()
        })

        .then(() => {

          this.openModal(
            'Ride Accepted',
            'You have successfully accepted the ride.',
            'success'
          );

          this.loadRideRequests();

        })

        .catch(error => {

          console.error(
            'Error accepting ride:',
            error
          );

          this.openModal(
            'Something Went Wrong',
            'Could not accept the ride.',
            'error'
          );

        });

    });

  }

  // ================================
  // UPDATE RIDE STATUS
  // ================================

  updateRideStatus(
    ride: any,
    status: string
  ) {

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
            ? { completedAt: new Date() }
            : {})

        })

        .then(() => {

          this.openModal(
            'Status Updated',
            `Ride status updated to ${status}.`,
            'success'
          );

          this.loadRideRequests();

        })

        .catch(error => {

          console.error(
            'Error updating ride:',
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

  // ================================
  // CANCEL RIDE
  // ================================

  cancelRide(ride: any) {

    const confirmed = confirm(
      'Are you sure you want to cancel this ride?'
    );

    if (!confirmed) {
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

          this.loadRideRequests();

        })

        .catch(error => {

          console.error(
            'Error cancelling ride:',
            error
          );

          this.openModal(
            'Something Went Wrong',
            'Could not cancel the ride.',
            'error'
          );

        });

    });

  }

  // ================================
  // LOAD DRIVER STATUS
  // ================================

  loadDriverStatus() {

    this.fireAuth.currentUser.then(user => {

      if (!user) {
        return;
      }

      this.firestore
        .collection('users')
        .doc(user.uid)
        .valueChanges()
        .subscribe((data: any) => {

          if (data) {

            this.driver = data;

            this.isOnline =
              data.isOnline || false;

          }

        });

    });

  }

  // ================================
  // TOGGLE ONLINE / OFFLINE
  // ================================

  toggleOnlineStatus() {

    this.fireAuth.currentUser.then(user => {

      if (!user) {

        this.openModal(
          'Login Required',
          'Please login first.',
          'error'
        );

        return;
      }

      this.loadingStatus = true;

      const newStatus = !this.isOnline;

      this.firestore
        .collection('users')
        .doc(user.uid)
        .update({
          isOnline: newStatus
        })

        .then(() => {

          this.isOnline = newStatus;
          this.loadingStatus = false;

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

          this.loadingStatus = false;

          this.openModal(
            'Something Went Wrong',
            'Could not update your online status.',
            'error'
          );

        });

    });

  }

}