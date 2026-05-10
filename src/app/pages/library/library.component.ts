import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { BookService } from '../../services/book.service';

import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

import { SearchService } from '../../services/search.service';

import { SecureImageDirective } from '../../directives/secure-image.directive';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, SecureImageDirective],
  templateUrl: './library.component.html',
  styleUrl: './library.component.css'
})
export class LibraryComponent implements OnInit {
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private bookService = inject(BookService);
  private searchService = inject(SearchService);
  
  private apiUrl = environment.apiUrl;
  
  user$ = this.authService.user$;
  allBooks: any[] = [];
  filteredBooks: any[] = [];
  selectedCategory = 'All';
  searchTerm = '';
  isFavoritesMode = false;
  selectedBook: any = null;
  isModalOpen = false;
  hasAccess = false;
  isLoading = true;
  newComment = '';
  editingCommentId: string | null = null;
  editingContent = '';

  // Order Form State
  isOrderFormOpen = false;
  isSuccessModalOpen = false;
  lastReferenceId = '';
  orderFormData = {
    fullName: '',
    whatsappNumber: '',
    message: ''
  };

  // Persistence
  favoritedBookIds: Set<string> = new Set();
  purchasedBookIds: Set<string> = new Set();

  ngOnInit(): void {
    this.loadLocalFavorites();
    this.fetchBooks();
    
    // Check mode based on URL
    this.route.url.subscribe(url => {
      this.isFavoritesMode = url[0]?.path === 'favorites';
      if (this.isFavoritesMode) {
        this.selectedCategory = 'All';
      }
    });

    // Fetch remote data once user is logged in
    this.authService.user$.subscribe(user => {
      if (user) {
        const userId = user.uid;
        if (userId) {
          this.fetchRemoteFavorites(userId);
          this.fetchUserLibrary(userId);
        }
      }
    });

    this.searchService.searchTerm$.subscribe(term => {
      this.searchTerm = term;
      this.onSearch();
    });
  }

  private loadLocalFavorites(): void {
    const saved = localStorage.getItem('bookvault_favorites');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        this.favoritedBookIds = new Set(ids);
      } catch (e) {}
    }
  }

  private saveLocalFavorites(): void {
    localStorage.setItem('bookvault_favorites', JSON.stringify(Array.from(this.favoritedBookIds)));
  }

  private fetchRemoteFavorites(userId: string): void {
    this.http.get<string[]>(`${this.apiUrl}/dashboard/user-favorites`).subscribe({
      next: (ids) => {
        if (ids && ids.length > 0) {
          ids.forEach(id => this.favoritedBookIds.add(id));
          this.saveLocalFavorites();
          // Refresh the view to show newly loaded favorites
          this.selectCategory(this.selectedCategory);
        }
      },
      error: (err) => console.error('Error fetching remote favorites', err)
    });
  }

  private fetchUserLibrary(userId: string): void {
    this.http.get<any[]>(`${this.apiUrl}/access/my-library`).subscribe({
      next: (accessList) => {
        if (accessList) {
          accessList.forEach(item => this.purchasedBookIds.add(item.bookId));
        }
      },
      error: (err) => console.error('Error fetching user library', err)
    });
  }

  isFavorited(bookId: string): boolean {
    return this.favoritedBookIds.has(bookId);
  }

  isPurchased(bookId: string): boolean {
    return this.purchasedBookIds.has(bookId);
  }

  orderBook(book: any): void {
    const user = this.authService.getCurrentUser();
    if (!user) {
      alert('Please login to access books');
      this.router.navigate(['/login']);
      return;
    }

    // If it's a free eBook or the user already has access (purchased), let them read it directly
    const isFree = book.type === 'FREE' || Number(book.price) === 0;
    
    if (isFree) {
      if (book.pdfUrl) {
        this.router.navigate(['/reader', book.id]);
      } else {
        alert('This free book is coming soon! Our editors are currently preparing the digital version.');
      }
      return;
    }

    if (this.hasAccess && book.pdfUrl) {
      this.router.navigate(['/reader', book.id]);
      return;
    }

    if (book.type === 'PAPERBACK') {
      this.processOrder(book, null);
    } else {
      // Open form for eBooks/Digital
      this.selectedBook = book;
      this.isOrderFormOpen = true;
    }
  }

  getPdfUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
      const apiBase = environment.apiUrl.replace('/api', '');
      return `${apiBase}${url}`;
    }
    return url;
  }

  submitOrder(): void {
    if (!this.orderFormData.fullName || !this.orderFormData.whatsappNumber) {
      alert('Please fill in all details');
      return;
    }
    this.processOrder(this.selectedBook, this.orderFormData);
  }

  private processOrder(book: any, details: any): void {
    this.authService.user$.subscribe((user: any) => {
      if (user && user.uid) {
        const orderPayload = {
          bookId: book.id,
          bookTitle: book.title,
          amount: book.price || 0,
          type: book.type === 'PAPERBACK' ? 'PAPERBACK_ORDER' : 'EBOOK_REQUEST',
          customerName: details?.fullName || user.email || 'User',
          whatsappNumber: details?.whatsappNumber || '',
          message: details?.message || '',
          status: 'CREATED'
        };

        this.http.post<any>(`${this.apiUrl}/orders`, orderPayload).subscribe({
          next: (res) => {
            this.lastReferenceId = res.referenceId;
            this.isOrderFormOpen = false;
            this.isSuccessModalOpen = true;
            this.orderFormData = { fullName: '', whatsappNumber: '', message: '' };
          },
          error: (err) => {
            console.error('Order failed', err);
            alert('Order failed. Please try again.');
          }
        });
      } else {
        alert('Please login to order books');
      }
    });
  }

  closeOrderForm(): void {
    this.isOrderFormOpen = false;
  }

  closeSuccessModal(): void {
    this.isSuccessModalOpen = false;
    this.isModalOpen = false; // Close the product detail too
  }

  addComment(): void {
    if (!this.newComment.trim() || !this.selectedBook) return;

    const userName = this.authService.getUserDisplayName();
      
      this.http.post(`${this.apiUrl}/books/${this.selectedBook.id}/comments`, {
        content: this.newComment,
        userName: userName
      }).subscribe({
        next: (comment: any) => {
          if (!this.selectedBook.comments) this.selectedBook.comments = [];
          this.selectedBook.comments.unshift(comment);
          this.newComment = '';
        },
        error: (err) => {
          console.error('Error adding comment', err);
          alert('Failed to add comment. (Auth might be required)');
        }
      });
  }

  startEdit(comment: any): void {
    this.editingCommentId = comment.id;
    this.editingContent = comment.content;
  }

  cancelEdit(): void {
    this.editingCommentId = null;
    this.editingContent = '';
  }

  saveEdit(comment: any): void {
    if (!this.editingContent.trim() || !this.selectedBook) return;

    this.http.put(`${this.apiUrl}/books/${this.selectedBook.id}/comments/${comment.id}`, 
      this.editingContent // Backend expects raw string body for content
    ).subscribe({
      next: (updatedBook: any) => {
        // Find the updated comment in the book and update it locally
        const idx = this.selectedBook.comments.findIndex((c: any) => c.id === comment.id);
        if (idx !== -1) {
          this.selectedBook.comments[idx].content = this.editingContent;
          this.selectedBook.comments[idx].updatedAt = new Date().toISOString();
        }
        this.cancelEdit();
      },
      error: (err) => {
        console.error('Error updating comment', err);
        alert('Failed to update comment.');
      }
    });
  }

  isMyComment(comment: any): boolean {
    const user = this.authService.getCurrentUser();
    return user && (comment.userId === user.id || comment.userId === user.firebaseUid);
  }

  openBookDetail(book: any): void {
    this.selectedBook = book;
    this.isModalOpen = true;
    this.hasAccess = false;

    this.authService.user$.subscribe(user => {
      if (user && user.uid) {
        this.http.get<boolean>(`${this.apiUrl}/access/check?bookId=${book.id}`).subscribe({
          next: (val) => this.hasAccess = val,
          error: () => this.hasAccess = false
        });
      }
    });

    // Increment readers count when detail is opened
    if (book.type !== 'PAPERBACK') {
      this.http.patch(`${this.apiUrl}/books/${book.id}/readers`, {}).subscribe({
        next: () => book.readersCount = (book.readersCount || 0) + 1
      });
    }
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedBook = null;
  }

  fetchBooks(): void {
    this.isLoading = true;
    this.http.get<any[]>(`${this.apiUrl}/public/books`).subscribe({
      next: (data) => {
        this.allBooks = data;
        this.isLoading = false;
        
        // Apply current category/mode filters
        this.selectCategory(this.selectedCategory);
      },
      error: (err) => {
        console.error('Error fetching books', err);
        this.isLoading = false;
      }
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory = category;
    
    // Base collection: All books OR only Favorited books
    let baseCollection = this.isFavoritesMode 
      ? this.allBooks.filter(b => this.isFavorited(b.id))
      : this.allBooks;


    if (category === 'All') {
      this.filteredBooks = baseCollection;
    } else if (category === 'Free') {
      this.filteredBooks = baseCollection.filter(b => b.price === 0 || b.type === 'FREE');
    } else if (category === 'Paid eBook') {
      this.filteredBooks = baseCollection.filter(b => b.type === 'PAID_EBOOK');
    } else if (category === 'Paperback') {
      this.filteredBooks = baseCollection.filter(b => b.type === 'PAPERBACK' || b.type === 'BOTH');
    } else if (category === 'Favorites') {
      this.filteredBooks = this.allBooks.filter(b => this.isFavorited(b.id));
    }

    // Apply Search Term (Always applies to the final result)
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      this.filteredBooks = this.filteredBooks.filter(b => 
        b.title?.toLowerCase().includes(term) || 
        b.author?.toLowerCase().includes(term)
      );
    }
  }

  onSearch(): void {
    this.selectCategory(this.selectedCategory);
  }

  deleteComment(comment: any): void {
    if (!this.selectedBook || !confirm('Are you sure you want to delete this review?')) return;

    this.http.delete(`${this.apiUrl}/books/${this.selectedBook.id}/comments/${comment.id}`).subscribe({
      next: () => {
        this.selectedBook.comments = this.selectedBook.comments.filter((c: any) => c.id !== comment.id);
      },
      error: (err) => {
        console.error('Error deleting comment', err);
        alert('Failed to delete comment.');
      }
    });
  }



  toggleFavorite(book: any, event: Event): void {
    event.stopPropagation();
    
    const bookId = book.id;
    const isAdding = !this.favoritedBookIds.has(bookId);

    this.http.patch(`${this.apiUrl}/books/${bookId}/favorites?increment=${isAdding}`, {}).subscribe({
      next: () => {
        if (isAdding) {
          this.favoritedBookIds.add(bookId);
          this.logFavoriteActivity(bookId, true);
        } else {
          this.favoritedBookIds.delete(bookId);
          this.logFavoriteActivity(bookId, false);
        }
        this.saveLocalFavorites();
        book.favoritesCount = (book.favoritesCount || 0) + (isAdding ? 1 : -1);
      },
      error: (err) => {
        console.error('Failed to toggle favorite', err);
      }
    });
  }

  private logFavoriteActivity(bookId: string, isAdding: boolean): void {
    this.authService.user$.subscribe((user: any) => {
      if (user && user.uid) {
        const activity = {
          userName: user.displayName || 'User',
          action: isAdding ? 'FAVORITE_BOOK' : 'UNFAVORITE_BOOK',
          detail: bookId
        };

        this.http.post(`${this.apiUrl}/dashboard/log-activity`, activity).subscribe({
          error: (err) => {} // Silent fail for logging
        });
      }
    });
  }

  getFavoritesCount(): number {
    return this.allBooks.reduce((acc, b) => acc + (b.favoritesCount || 0), 0);
  }

  getButtonLabel(book: any): string {
    if (book.type === 'PAPERBACK') return 'Order Physical Copy';
    
    // If it's digital but has no PDF, it's a request/notification flow
    if (!book.pdfUrl) return 'Request Access';
    
    return 'Read Now';
  }

  getCoverUrl(url: string, bookId?: string): string {
    return this.bookService.getCoverUrl(url, bookId);
  }
}
