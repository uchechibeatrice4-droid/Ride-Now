import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {

  constructor(private authService: AuthService,
    private router: Router) { }

  logout() {
    this.authService.logout().then(() => {
      this.router.navigate(['/login']);
    });
  }

  goToRequestRide() {
    this.router.navigate(['/request-ride']);
  }

  goToRideHistory() {
    this.router.navigate(['/ride-history']);
  }

  goToMyProfile() {
    this.router.navigate(['/profile']);
  }
}