import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-order-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-management.component.html',
  styleUrls: ['./order-management.component.css']
})
export class OrderManagementComponent implements OnInit {
  orders: any[] = [];
  filteredOrders: any[] = [];
  private apiUrl = environment.apiUrl;
  baseUrl = `${this.apiUrl}/orders`;

  statusLabels: { [key: string]: string } = {
    'PENDING': 'Pending',
    'PAYMENT_PENDING': 'Payment Pending',
    'SHIPMENT_PENDING': 'Shipment is Pending',
    'DELIVERED': 'Order Delivered',
    'COMPLETED': 'Completed',
    'REJECTED': 'Reject'
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchOrders();
  }

  fetchOrders(): void {
    this.http.get<any[]>(this.baseUrl).subscribe({
      next: (data) => {
        // Sort orders by date descending (newest first)
        this.orders = data.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.orderDate || 0).getTime();
          const dateB = new Date(b.createdAt || b.orderDate || 0).getTime();
          return dateB - dateA;
        });
        this.filteredOrders = [...this.orders];
      },
      error: (err) => console.error('Error fetching orders', err)
    });
  }

  updateStatus(id: string, status: string): void {
    this.http.patch(`${this.baseUrl}/${id}/status?status=${status}`, {}).subscribe({
      next: () => {
        const order = this.orders.find(o => o.id === id);
        if (order) order.status = status;
        alert(`Order status updated to ${status} successfully.`);
      },
      error: (err) => {
        console.error('Error updating order status', err);
        alert('Failed to update order status. Please check backend logs.');
      }
    });
  }

  filterByStatus(event: any): void {
    const status = event.target.value;
    if (!status) {
      this.filteredOrders = this.orders;
    } else {
      this.filteredOrders = this.orders.filter(o => o.status === status);
    }
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status] || status;
  }
}
