import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { DashboardComponent as RiderDashboardComponent } from './rider/dashboard/dashboard.component';
import { DashboardComponent as DriverDashboardComponent } from './driver/dashboard/dashboard.component';
import { DashboardComponent as AdminDashboardComponent } from './admin/dashboard/dashboard.component';
import { AuthGuard } from './core/auth.guard';
import { RoleGuard } from './core/role.guard';
import { RequestRideComponent } from './rider/request-ride/request-ride.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent, canActivate: [AuthGuard] },
  { path: 'rider-dashboard', component: RiderDashboardComponent, canActivate: [RoleGuard], data: { role: 'rider' } },
  { path: 'request-ride', component: RequestRideComponent, canActivate: [RoleGuard], data: { role: 'rider' } },
  { path: 'driver-dashboard', component: DriverDashboardComponent, canActivate: [RoleGuard], data: { role: 'driver' } },
  { path: 'admin-dashboard', component: AdminDashboardComponent, canActivate: [RoleGuard], data: { role: 'admin' } },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
