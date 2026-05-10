import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { BookService } from '../../services/book.service';
import { environment } from '../../../environments/environment';

import { SecureImageDirective } from '../../directives/secure-image.directive';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, SecureImageDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private bookService = inject(BookService);
  private apiUrl = environment.apiUrl;
  
  user$ = this.authService.user$;
  stats = {
    purchased: 0,
    read: 0,
    favorites: 0
  };

  get userName(): string {
    return this.authService.getUserDisplayName();
  }
  recentlyRead: any[] = [];
  isLoading = true;

  ngOnInit(): void {
    // Subscribe to user changes to ensure stats load even if sync takes a moment
    this.authService.user$.subscribe(fbUser => {
      if (fbUser) {
        this.fetchDashboardData(fbUser.uid);
      }
    });
  }

  fetchDashboardData(userId: string): void {
    this.isLoading = true;
    
    // 1. Fetch Real Stats
    this.http.get<any>(`${this.apiUrl}/dashboard/stats`).subscribe({
      next: (res) => {
        this.stats = res;
      },
      error: (err) => console.error('Error fetching dashboard stats', err)
    });

    // 2. Fetch Actual Recently Read
    this.http.get<any[]>(`${this.apiUrl}/dashboard/recent-reading`).subscribe({
      next: (data) => {
        this.recentlyRead = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching recent reading', err);
        this.isLoading = false;
      }
    });
  }

  getCoverUrl(url: string, bookId?: string): string {
    return this.bookService.getCoverUrl(url, bookId);
  }
}
