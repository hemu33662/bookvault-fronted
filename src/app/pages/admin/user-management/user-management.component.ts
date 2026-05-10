import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  private apiUrl = environment.apiUrl;
  baseUrl = `${this.apiUrl}/admin/users`;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.http.get<any[]>(this.baseUrl).subscribe({
      next: (data) => this.users = data,
      error: (err) => console.error('Error fetching users', err)
    });
  }

  toggleStatus(user: any, newStatus: string): void {
    this.http.patch(`${this.baseUrl}/${user.id}/status?status=${newStatus}`, {}).subscribe({
      next: () => {
        user.status = newStatus;
      },
      error: (err) => console.error('Error updating user status', err)
    });
  }
}
