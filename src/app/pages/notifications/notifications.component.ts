import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notifications-page animate-fade">
      <div class="page-header">
        <h1 class="serif">Announcements</h1>
        <p class="subtitle">Stay updated with the latest news and updates from the BookVault team.</p>
      </div>

      <div class="notifications-container">
        @if (isLoading) {
          <div class="loading-state">
            <i class="bi bi-arrow-clockwise spin"></i>
            <p>Fetching latest updates...</p>
          </div>
        } @else {
          <div class="notes-grid">
            @for (note of notifications; track note.id) {
              <div class="note-card">
                <div class="note-icon">
                  <i class="bi bi-megaphone-fill"></i>
                </div>
                <div class="note-content">
                  <div class="note-header">
                    <span class="note-tag">OFFICIAL</span>
                    <span class="note-date">{{ note.createdAt | date:'mediumDate' }}</span>
                  </div>
                  <p class="note-message serif">{{ note.message }}</p>
                </div>
              </div>
            } @empty {
              <div class="empty-state">
                <div class="empty-icon"><i class="bi bi-bell-slash"></i></div>
                <h3>All Caught Up!</h3>
                <p>There are no new notifications at the moment. Check back later for exciting updates.</p>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .notifications-page {
      padding: 1rem;
    }
    .page-header {
      margin-bottom: 2.5rem;
    }
    .page-header h1 {
      font-size: 2.25rem;
      color: #0f172a;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #64748b;
      font-size: 1rem;
    }
    .notes-grid {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      max-width: 900px;
    }
    .note-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 1.5rem;
      display: flex;
      gap: 1.5rem;
      transition: all 0.3s ease;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .note-card:hover {
      transform: translateX(8px);
      border-color: #6366f1;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    }
    .note-icon {
      width: 48px;
      height: 48px;
      background: #f1f5f9;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6366f1;
      font-size: 1.25rem;
      flex-shrink: 0;
    }
    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .note-tag {
      font-size: 0.7rem;
      font-weight: 700;
      background: #eef2ff;
      color: #4f46e5;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .note-date {
      font-size: 0.75rem;
      color: #94a3b8;
    }
    .note-message {
      font-size: 1.1rem;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 5rem 2rem;
      color: #94a3b8;
    }
    .spin { animation: spin 1s linear infinite; display: inline-block; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .empty-icon { font-size: 3rem; margin-bottom: 1rem; color: #e2e8f0; }
  `]
})
export class NotificationsComponent implements OnInit {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  
  notifications: any[] = [];
  isLoading = true;

  ngOnInit() {
    this.fetchNotifications();
  }

  fetchNotifications() {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/public/announcements`).subscribe({
      next: (data) => {
        this.notifications = data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching notifications', err);
        this.isLoading = false;
      }
    });
  }
}
