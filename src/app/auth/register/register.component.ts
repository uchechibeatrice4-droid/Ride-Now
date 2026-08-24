import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {

  registerForm = this.fb.group({
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['rider', Validators.required]
  });

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) { }

  register() {
    if (this.registerForm.invalid) {
      return;
    }

    const email = this.registerForm.value.email!;
    const password = this.registerForm.value.password!;

    const fullName = this.registerForm.value.fullName!;
    const role = this.registerForm.value.role as 'rider' | 'driver';

    this.authService.register(email, password, fullName, role)
  }
}