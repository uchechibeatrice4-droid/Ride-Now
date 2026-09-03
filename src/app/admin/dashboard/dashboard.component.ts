import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {

  totalUsers = 0;
  totalRides = 0;
  completedRides = 0;
  cancelledRides = 0;
  totalRevenue = 0;

  recentRides: any[] = [];

  users: any[] = [];
  searchText: string = '';

  constructor(
    private firestore: AngularFirestore
  ) { }

  ngOnInit(): void {
    this.loadUsers();
    this.loadRides();
  }

  // Load users
  loadUsers() {

    this.firestore
      .collection('users')
      .valueChanges({ idField: 'id' })
      .subscribe((users: any[]) => {

        this.totalUsers = users.length;
        this.users = users;

      });

  }

  // Load rides
  loadRides() {

    this.firestore
      .collection('rides')
      .valueChanges({ idField: 'id' })
      .subscribe((rides: any[]) => {

        this.totalRides = rides.length;

        this.completedRides = rides.filter(
          ride => ride.status === 'completed'
        ).length;

        this.cancelledRides = rides.filter(
          ride => ride.status === 'cancelled'
        ).length;

        // Calculate revenue from paid completed rides
        this.totalRevenue = rides
          .filter(
            ride =>
              ride.status === 'completed' &&
              ride.paymentStatus === 'paid'
          )
          .reduce(
            (total, ride) => total + Number(ride.fare || 0),
            0
          );

        // Show latest rides
        this.recentRides = rides
          .sort((a, b) => {

            const dateA = a.createdAt?.toDate
              ? a.createdAt.toDate()
              : new Date(0);

            const dateB = b.createdAt?.toDate
              ? b.createdAt.toDate()
              : new Date(0);

            return dateB.getTime() - dateA.getTime();

          })
          .slice(0, 5);

      });

  }

  toggleUserStatus(user: any) {

    const newStatus = !user.isActive;

    this.firestore
      .collection('users')
      .doc(user.id)
      .update({
        isActive: newStatus
      })
      .then(() => {
        alert(
          newStatus
            ? 'User activated successfully.'
            : 'User deactivated successfully.'
        );
      })
      .catch(error => {
        console.error('Error updating user:', error);
        alert('Could not update user status.');
      });
  }

  get filteredUsers() {

    const search = this.searchText.toLowerCase().trim();

    if (!search) {
      return this.users;
    }

    return this.users.filter(user =>
      user.fullName?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search)
    );
  }

}