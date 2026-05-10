import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';
import { Auth, user } from '@angular/fire/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private auth = inject(Auth);
  private apiUrl = environment.apiUrl;

  // Observable for the current user from Firebase
  user$ = user(this.auth);
  
  // Local cache for the backend user entity
  private currentUser: any = null;

  async syncUserWithBackend(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${this.apiUrl}/users/sync`, {})
      );
      this.currentUser = response;
      return response;
    } catch (error) {
      console.error('Failed to sync user with backend:', error);
      throw error;
    }
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserDisplayName(): string {
    // 1. Prefer Backend Name if it's not "Admin"
    if (this.currentUser?.displayName && this.currentUser.displayName !== 'Admin') {
      return this.currentUser.displayName;
    }
    // 2. Check Firebase Display Name
    const fbUser = this.auth.currentUser;
    if (fbUser?.displayName && fbUser.displayName !== 'Admin') {
      return fbUser.displayName;
    }
    // 3. Fallback to "Hemanth" for the owner
    return 'Hemanth';
  }

  async logout() {
    await this.auth.signOut();
  }
}
