import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-security-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './security-dashboard.component.html',
  styleUrls: ['./security-dashboard.component.css']
})
export class SecurityDashboardComponent implements OnInit {
  sessions: any[] = [];
  private apiUrl = environment.apiUrl;
  baseUrl = `${this.apiUrl}/admin/security`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchSessions();
  }

  fetchSessions(): void {
    this.http.get<any[]>(`${this.baseUrl}/sessions`).subscribe({
      next: (data) => this.sessions = data,
      error: (err) => console.error('Error fetching sessions', err)
    });
  }

  revokeSession(id: string): void {
    this.http.post(`${this.baseUrl}/sessions/${id}/revoke`, {}).subscribe({
      next: () => this.fetchSessions(),
      error: (err) => console.error('Error revoking session', err)
    });
  }

  logoutAll(): void {
    if (confirm('Are you sure you want to force logout ALL users from all devices?')) {
      this.http.post(`${this.baseUrl}/logout-all`, {}).subscribe({
        next: () => this.fetchSessions(),
        error: (err) => console.error('Error triggering global logout', err)
      });
    }
  }
}
