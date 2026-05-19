import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Auth, signInWithEmailAndPassword, sendPasswordResetEmail } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = 'hemanth.nitm@gmail.com';
  password = 'c7bcdc32ffd7394bc9fff1a4263d12f90f4e1ea0';
  errorMessage = '';
  successMessage = '';
  isLoading = false;

  private auth: Auth = inject(Auth);
  private router: Router = inject(Router);
  private authService = inject(AuthService);

  async onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    try {
      await signInWithEmailAndPassword(this.auth, this.email, this.password);
      try {
        const user: any = await this.authService.syncUserWithBackend();

        if (user.role === 'ADMIN') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.router.navigate(['/app/library']);
        }
      } catch (syncError) {
        console.error('Backend sync failed:', syncError);
        this.errorMessage = 'Logged in to Firebase, but failed to sync with backend. Is the server running?';
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential') {
        this.errorMessage = 'Invalid email or password.';
      } else {
        this.errorMessage = 'An error occurred during login: ' + (error.message || error.code);
      }
    } finally {
      this.isLoading = false;
    }
  }
  async forgotPassword(event: Event) {
    event.preventDefault();
    this.errorMessage = '';
    this.successMessage = '';
    
    if (!this.email) {
      this.errorMessage = 'Please enter your email address to reset your password.';
      return;
    }

    this.isLoading = true;

    try {
      await sendPasswordResetEmail(this.auth, this.email);
      this.successMessage = 'Password reset email sent. Please check your inbox and spam folder.';
    } catch (error: any) {
      console.error('Password reset error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
         this.errorMessage = 'Please enter a valid, registered email address.';
      } else {
         this.errorMessage = 'Failed to send password reset email: ' + (error.message || error.code);
      }
    } finally {
      this.isLoading = false;
    }
  }
}
