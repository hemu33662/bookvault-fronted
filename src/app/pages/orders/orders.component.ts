import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  
  orders: any[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.authService.user$.subscribe(user => {
      if (user && user.uid) {
        this.fetchOrders(user.uid);
      }
    });
  }

  fetchOrders(userId: string): void {
    this.isLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/orders/my-orders`).subscribe({
      next: (data) => {
        // Sort orders by date descending (newest first)
        this.orders = data.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.orderDate || 0).getTime();
          const dateB = new Date(b.createdAt || b.orderDate || 0).getTime();
          return dateB - dateA;
        });
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching orders', err);
        this.orders = [];
        this.isLoading = false;
      }
    });
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-pending';
    switch (status.toLowerCase()) {
      case 'approved':
      case 'completed':
      case 'delivered':
        return 'status-success';
      case 'pending':
        return 'status-warning';
      case 'cancelled':
      case 'rejected':
        return 'status-danger';
      default:
        return 'status-pending';
    }
  }
}
