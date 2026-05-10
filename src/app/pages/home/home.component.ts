import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BookService } from '../../services/book.service';
import { environment } from '../../../environments/environment';

import { SecureImageDirective } from '../../directives/secure-image.directive';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, SecureImageDirective],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  isMenuOpen = false;
  isAboutExpanded = false;
  isFavoritesMode = false;
  isNotificationsMode = false;
  notifications: any[] = [];
  allBooks: any[] = [];
  filteredBooks: any[] = [];
  selectedCategory: string = 'All';
  private apiUrl = environment.apiUrl;
  baseUrl = `${this.apiUrl}/public/books`;

  constructor(private http: HttpClient, private router: Router, private bookService: BookService) { }

  ngOnInit(): void {
    this.fetchBooks();
    this.fetchNotifications();
  }

  fetchBooks(): void {
    this.http.get<any[]>(this.baseUrl).subscribe({
      next: (data) => {
        this.allBooks = data;
        this.selectCategory('All');
      },
      error: (err) => console.error('Error fetching books', err)
    });
  }

  fetchNotifications(): void {
    this.http.get<any[]>(`${this.apiUrl}/public/announcements`).subscribe({
      next: (data) => {
        this.notifications = data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      error: (err) => console.error('Error fetching notifications', err)
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredBooks = this.allBooks;
    } else if (category === 'Free') {
      this.filteredBooks = this.allBooks.filter(b => b.price === 0);
    } else if (category === 'Paid eBook') {
      this.filteredBooks = this.allBooks.filter(b => b.price > 0 && b.type !== 'PAPERBACK');
    } else if (category === 'Paperback') {
      this.filteredBooks = this.allBooks.filter(b => b.type === 'PAPERBACK' || b.type === 'BOTH');
    } else if (category === 'Notifications') {
      this.isNotificationsMode = true;
    }

    if (category !== 'Notifications') {
      this.isNotificationsMode = false;
    }
  }

  scrollTo(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.isMenuOpen = false; // Close menu on mobile after clicking
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  getCoverUrl(url: string, bookId?: string): string {
    return this.bookService.getCoverUrl(url, bookId);
  }
}
