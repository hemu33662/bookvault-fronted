import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  isSidebarOpen = false;
  stats: any;
  activities: any[] = [];
  notifications: any[] = [];
  private apiUrl = environment.apiUrl;
  baseUrl = `${this.apiUrl}/admin/dashboard`;
  isSyncing = false;
  newNotificationMessage = '';
  isBroadcasting = false;

  private http = inject(HttpClient);
  private router = inject(Router);

  ngOnInit(): void {
    this.syncData();
  }

  syncData(): void {
    this.isSyncing = true;
    this.fetchStats();
    this.fetchActivity();
    this.fetchNotifications();
    setTimeout(() => this.isSyncing = false, 800); // Visual feedback
  }

  fetchStats(): void {
    this.http.get(`${this.baseUrl}/stats`).subscribe({
      next: (data) => this.stats = data,
      error: (err) => console.error('Error fetching stats', err)
    });
  }

  fetchActivity(): void {
    this.http.get<any[]>(`${this.baseUrl}/activity`).subscribe({
      next: (data) => this.activities = data,
      error: (err) => console.error('Error fetching activity', err)
    });
  }

  fetchNotifications(): void {
    this.http.get<any[]>(`${this.baseUrl}/notifications`).subscribe({
      next: (data) => {
        this.notifications = data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      error: (err) => console.error('Error fetching notifications', err)
    });
  }

  onAddBook() {
    this.router.navigate(['/admin/books']);
  }

  broadcastNotification() {
    if (!this.newNotificationMessage.trim()) return;
    
    this.isBroadcasting = true;
    this.http.post(`${this.baseUrl}/broadcast`, { message: this.newNotificationMessage }).subscribe({
      next: () => {
        this.newNotificationMessage = '';
        this.isBroadcasting = false;
        this.fetchNotifications();
      },
      error: (err) => {
        alert('Failed to create notification');
        this.isBroadcasting = false;
      }
    });
  }

  onDeleteNotification(id: string) {
    if (confirm('Are you sure you want to delete this notification?')) {
      this.http.delete(`${this.baseUrl}/notifications/${id}`).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== id);
        },
        error: (err) => alert('Failed to delete notification')
      });
    }
  }

  onRunAudit() {
    alert('Security Audit Level 4 initiated... Scanning system logs.');
  }

  onRestartServices() {
    if (confirm('Are you sure you want to restart platform services? This will cause temporary downtime.')) {
      alert('Service restart sequence initiated.');
    }
  }

  getActivityIcon(action: string): string {
    switch (action) {
      case 'PURCHASED_BOOK': return 'bi-cart-check';
      case 'POSTED_COMMENT': return 'bi-chat-text';
      case 'LOGGED_IN': return 'bi-person-check';
      case 'ORDER_APPROVED': return 'bi-check-circle';
      default: return 'bi-lightning';
    }
  }

  formatAction(action: string): string {
    return action.toLowerCase().replace(/_/g, ' ');
  }
}
