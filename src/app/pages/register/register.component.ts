import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Auth, createUserWithEmailAndPassword, updateProfile } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  name = '';
  email = '';
  password = '';
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private authService = inject(AuthService);

  async onSubmit() {
    if (!this.name || !this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, this.email, this.password);

      // Update display name
      await updateProfile(userCredential.user, {
        displayName: this.name
      });

      // Sync with backend to create the user entity in Firestore
      try {
        await this.authService.syncUserWithBackend();
      } catch (syncError: any) {
        console.error('Backend sync failed after registration:', syncError);
      }

      this.successMessage = 'Account created successfully! Redirecting...';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 2000);
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        this.errorMessage = 'An account with this email already exists.';
      } else {
        this.errorMessage = 'An error occurred during registration: ' + (error.message || error.code);
      }
    } finally {
      this.isLoading = false;
    }
  }
}
