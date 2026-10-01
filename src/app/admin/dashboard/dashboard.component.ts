import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  // =========================
  // STATISTICS
  // =========================

  totalUsers = 0;
  totalRiders = 0;
  totalDrivers = 0;
  activeDrivers = 0;

  totalRides = 0;
  completedRides = 0;
  cancelledRides = 0;

  totalRevenue = 0;


  // =========================
  // DATA
  // =========================

  users: any[] = [];
  rides: any[] = [];

  recentRides: any[] = [];

  searchText = '';
  rideSearchText = '';

  selectedRideStatus = 'all';

  // =========================
  // FEES
  // =========================

  standardBaseFare = 1000;
  standardPerKm = 180;

  premiumBaseFare = 1500;
  premiumPerKm = 250;

  savingFees = false;


  // =========================
  // MODAL
  // =========================

  modalVisible = false;

  modalTitle = '';

  modalMessage = '';

  modalType:
    'success' |
    'error' |
    'confirm' = 'success';

  pendingUserAction: any = null;
  pendingAction: 'driver' | 'logout' | null = null;

  feesSaved = false;

  editingFees = false;


  // =========================
  // CONSTRUCTOR
  // =========================

  constructor(
    private firestore: AngularFirestore,
    private auth: AngularFireAuth,
    private router: Router
  ) { }


  // =========================
  // INITIALIZE
  // =========================

  ngOnInit(): void {

    this.loadUsers();

    this.loadRides();

    this.loadFees();

  }

  editFees(): void {
    this.editingFees = true;
  }

  cancelEditFees(): void {
    this.loadFees();
    this.editingFees = false;
  }


  // =========================
  // LOAD USERS
  // =========================

  loadUsers(): void {

    this.firestore
      .collection('users')
      .valueChanges({ idField: 'id' })
      .subscribe({

        next: (users: any[]) => {

          this.users = users;

          this.totalUsers =
            users.length;


          this.totalRiders =
            users.filter(
              user =>
                user.role === 'rider'
            ).length;


          this.totalDrivers =
            users.filter(
              user =>
                user.role === 'driver'
            ).length;


          this.activeDrivers =
            users.filter(
              user =>
                user.role === 'driver' &&
                user.isActive === true
            ).length;

        },

        error: error => {

          console.error(
            'Error loading users:',
            error
          );

        }

      });

  }


  // =========================
  // LOAD RIDES
  // =========================

  loadRides(): void {

    this.firestore
      .collection('rides')
      .valueChanges({ idField: 'id' })
      .subscribe({

        next: (rides: any[]) => {

          this.rides = rides;

          this.totalRides =
            rides.length;


          this.completedRides =
            rides.filter(
              ride =>
                ride.status === 'completed'
            ).length;


          this.cancelledRides =
            rides.filter(
              ride =>
                ride.status === 'cancelled'
            ).length;


          // Revenue from completed
          // and paid rides only

          this.totalRevenue =
            rides
              .filter(
                ride =>
                  ride.status === 'completed' &&
                  ride.paymentStatus === 'paid'
              )
              .reduce(
                (total, ride) =>
                  total +
                  Number(ride.fare || 0),
                0
              );


          // Latest rides

          this.recentRides =
            [...rides]
              .sort((a, b) => {

                const dateA =
                  this.getDateValue(
                    a.createdAt
                  );

                const dateB =
                  this.getDateValue(
                    b.createdAt
                  );

                return dateB - dateA;

              })
              .slice(0, 5);

        },

        error: error => {

          console.error(
            'Error loading rides:',
            error
          );

        }

      });

  }


  // =========================
  // DATE HELPER
  // =========================

  private getDateValue(
    date: any
  ): number {

    if (!date) {
      return 0;
    }

    if (date.toDate) {

      return date
        .toDate()
        .getTime();

    }

    return new Date(date)
      .getTime();

  }


  // =========================
  // USER SEARCH
  // =========================

  get filteredUsers(): any[] {

    const search =
      this.searchText
        .toLowerCase()
        .trim();


    if (!search) {

      return this.users;

    }


    return this.users.filter(
      user =>
        user.fullName
          ?.toLowerCase()
          .includes(search) ||

        user.email
          ?.toLowerCase()
          .includes(search) ||

        user.role
          ?.toLowerCase()
          .includes(search)
    );

  }


  // =========================
  // RIDE SEARCH + FILTER
  // =========================

  get filteredRides(): any[] {

    const search =
      this.rideSearchText
        .toLowerCase()
        .trim();


    return this.rides.filter(
      ride => {

        const matchesStatus =
          this.selectedRideStatus === 'all' ||
          ride.status ===
          this.selectedRideStatus;


        const matchesSearch =
          !search ||

          ride.pickup
            ?.toLowerCase()
            .includes(search) ||

          ride.destination
            ?.toLowerCase()
            .includes(search) ||

          ride.rideType
            ?.toLowerCase()
            .includes(search) ||

          ride.paymentMethod
            ?.toLowerCase()
            .includes(search) ||

          ride.status
            ?.toLowerCase()
            .includes(search);


        return (
          matchesStatus &&
          matchesSearch
        );

      }
    );

  }

  // =========================
  // LOAD FEES
  // =========================

  loadFees(): void {

    this.firestore
      .collection('settings')
      .doc('fees')
      .valueChanges()
      .subscribe({

        next: (fees: any) => {

          if (fees) {

            this.standardBaseFare =
              Number(fees.standardBaseFare ?? 1000);

            this.standardPerKm =
              Number(fees.standardPerKm ?? 180);

            this.premiumBaseFare =
              Number(fees.premiumBaseFare ?? 1500);

            this.premiumPerKm =
              Number(fees.premiumPerKm ?? 250);

          }

        },

        error: error => {

          console.error(
            'Error loading fees:',
            error
          );

        }

      });

  }


  // =========================
  // SAVE FEES
  // =========================

  saveFees(): void {

    const values = [
      this.standardBaseFare,
      this.standardPerKm,
      this.premiumBaseFare,
      this.premiumPerKm
    ];

    if (
      values.some(
        value =>
          isNaN(Number(value)) ||
          Number(value) < 0
      )
    ) {

      this.openModal(
        'Invalid Fees',
        'Fee values cannot be negative.',
        'error'
      );

      return;

    }


    this.savingFees = true;


    this.firestore
      .collection('settings')
      .doc('fees')
      .set({

        standardBaseFare:
          Number(this.standardBaseFare),

        standardPerKm:
          Number(this.standardPerKm),

        premiumBaseFare:
          Number(this.premiumBaseFare),

        premiumPerKm:
          Number(this.premiumPerKm),

        updatedAt:
          new Date()

      }, { merge: true })

      .then(() => {
        this.savingFees = false;
        this.editingFees = false;

        this.openModal(
          'Fees Saved',
          'Ride fees have been updated successfully.',
          'success'
        );
      })

      .catch(error => {

        console.error(
          'Error saving fees:',
          error
        );

        this.savingFees = false;
        this.feesSaved = true;

        this.openModal(
          'Fees Saved',
          'Ride fees have been updated successfully.',
          'success'
        );

        setTimeout(() => {
          this.feesSaved = false;
        }, 3000);

      });

  }


  // =========================
  // DRIVER STATUS
  // =========================

  toggleUserStatus(user: any): void {

    // Riders cannot have driver status changed
    if (user.role === 'rider') {

      this.openModal(
        'Action Not Allowed',
        'Rider accounts cannot have driver status changed.',
        'error'
      );

      return;
    }


    // Admin accounts are protected
    if (user.role === 'admin') {

      this.openModal(
        'Action Not Allowed',
        'Admin accounts are protected and cannot be deactivated.',
        'error'
      );

      return;
    }


    // Only drivers can continue
    if (user.role !== 'driver') {

      this.openModal(
        'Action Not Allowed',
        'Only driver accounts can be activated or deactivated.',
        'error'
      );

      return;
    }


    this.pendingUserAction = user;
    this.pendingAction = 'driver';


    const action =
      user.isActive
        ? 'deactivate'
        : 'activate';


    this.openModal(
      `${action === 'activate'
        ? 'Activate'
        : 'Deactivate'} Driver`,

      `Are you sure you want to ${action} this driver?`,

      'confirm'
    );

  }


  // =========================
  // CONFIRM DRIVER STATUS
  // =========================

  confirmAction(): void {

    // =========================
    // LOGOUT
    // =========================

    if (this.pendingAction === 'logout') {

      this.auth
        .signOut()
        .then(() => {

          this.modalVisible = false;
          this.pendingAction = null;

          this.router.navigate(['/login']);

        })
        .catch(error => {

          console.error(
            'Logout error:',
            error
          );

          this.pendingAction = null;

          this.openModal(
            'Logout Failed',
            'Could not logout. Please try again.',
            'error'
          );

        });

      return;
    }


    // =========================
    // DRIVER STATUS
    // =========================

    if (
      this.pendingAction === 'driver' &&
      this.pendingUserAction
    ) {

      const user =
        this.pendingUserAction;


      // Extra protection:
      // Only drivers can be changed.

      if (user.role !== 'driver') {

        this.closeModal();

        return;

      }


      const newStatus =
        !user.isActive;


      this.modalVisible = false;

      this.pendingUserAction = null;
      this.pendingAction = null;


      this.firestore
        .collection('users')
        .doc(user.id)
        .update({

          isActive: newStatus

        })
        .then(() => {

          this.openModal(

            newStatus
              ? 'Driver Activated'
              : 'Driver Deactivated',

            newStatus
              ? 'The driver has been activated successfully.'
              : 'The driver has been deactivated successfully.',

            'success'

          );

        })
        .catch(error => {

          console.error(
            'Error updating driver status:',
            error
          );


          this.openModal(

            'Update Failed',

            'Could not update the driver status. Please try again.',

            'error'

          );

        });

    }

  }


  // =========================
  // LOGOUT
  // =========================

  logout(): void {

    this.pendingAction = 'logout';

    this.pendingUserAction = null;

    this.openModal(
      'Logout',
      'Are you sure you want to logout from the admin dashboard?',
      'confirm'
    );

  }


  // =========================
  // CONFIRM LOGOUT
  // =========================

  confirmLogout(): void {

    this.auth
      .signOut()
      .then(() => {

        this.modalVisible = false;

        this.router.navigate(['/login']);

      })
      .catch(error => {

        console.error(
          'Logout error:',
          error
        );


        this.openModal(

          'Logout Failed',

          'Could not logout. Please try again.',

          'error'

        );

      });

  }


  // =========================
  // MODAL
  // =========================

  openModal(
    title: string,
    message: string,
    type:
      'success' |
      'error' |
      'confirm'
  ): void {

    this.modalTitle =
      title;

    this.modalMessage =
      message;

    this.modalType =
      type;

    this.modalVisible =
      true;

  }


  closeModal(): void {

    this.modalVisible =
      false;

    this.pendingUserAction =
      null;

    this.pendingAction =
      null;

  }

}