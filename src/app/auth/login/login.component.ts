import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { Router } from '@angular/router'; 

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router  
  ) {}

 login() {
  if (this.loginForm.invalid) {
    return;
  }

  const email = this.loginForm.value.email!;
  const password = this.loginForm.value.password!;

  this.authService.login(email, password)
    .then((result) => {

      const uid = result.user?.uid;

      if (!uid) {
        throw new Error('User ID not found.');
      }

      this.authService.getUserProfile(uid).subscribe(profile => {

        if (!profile) {
          alert('User profile not found.');
          return;
        }

        console.log('User profile:', profile);

        if (profile.role === 'rider') {
          this.router.navigate(['/rider-dashboard']);
        } 
        else if (profile.role === 'driver') {
          this.router.navigate(['/driver-dashboard']);
        } 
        else if (profile.role === 'admin') {
          this.router.navigate(['/admin-dashboard']);
        }

      });

    })
    .catch((error) => {
      alert(error.message);
    });
}
}