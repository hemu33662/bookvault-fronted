import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { BookService } from '../../../services/book.service';
import { environment } from '../../../../environments/environment';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

import { SecureImageDirective } from '../../../directives/secure-image.directive';

@Component({
  selector: 'app-book-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SecureImageDirective],
  templateUrl: './book-management.component.html',
  styleUrl: './book-management.component.css'
})
export class BookManagementComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  public bookService = inject(BookService);

  private apiUrl = environment.apiUrl;

  books: any[] = [];
  bookForm: FormGroup;
  showModal = false;
  isEditing = false;
  editingBookId: number | null = null;
  isSubmitting = false;
  selectedFile: File | null = null;
  selectedCoverFile: File | null = null;
  coverPreview: string | null = null;
  autoExtractCover = true; // Enabled by default
  isExtractingCover = false;
  baseUrl = `${this.apiUrl}/books`;

  constructor() {
    this.bookForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(2)]],
      author: ['', Validators.required],
      description: ['', Validators.required],
      genre: ['Fiction', Validators.required],
      type: ['PAID_EBOOK', Validators.required],
      price: [0, [Validators.required, Validators.min(0)]],
      coverImageUrl: [''],
      status: ['PUBLISHED'],
      isFeatured: [false],
      isBestseller: [false],
      pdfUrl: ['']
    });
  }

  ngOnInit(): void {
    this.fetchBooks();
  }

  get ebookCount(): number {
    return this.books.filter(b => b.type === 'PAID_EBOOK' || b.type === 'FREE' || b.type === 'BOTH').length;
  }

  get totalBooks(): number {
    return this.books.length;
  }

  fetchBooks(): void {
    this.http.get<any[]>(`${this.apiUrl}/public/books`).subscribe({
      next: (data) => this.books = data,
      error: (err) => console.error('Error fetching books', err)
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      if (this.autoExtractCover && file.type === 'application/pdf') {
        this.extractCoverFromPdf(file);
      }
    }
  }

  async extractCoverFromPdf(file: File) {
    this.isExtractingCover = true;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({ canvasContext: context!, viewport }).promise;
      
      canvas.toBlob((blob) => {
        if (blob) {
          const coverFile = new File([blob], 'cover.png', { type: 'image/png' });
          this.selectedCoverFile = coverFile;
          this.coverPreview = URL.createObjectURL(blob);
          this.isExtractingCover = false;
        }
      }, 'image/png');

    } catch (err) {
      console.error('Failed to extract cover', err);
      this.isExtractingCover = false;
    }
  }

  onCoverSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedCoverFile = file;
      this.coverPreview = URL.createObjectURL(file);
      this.autoExtractCover = false; // Disable auto-extract if user manually picks a cover
    }
  }

  openAddModal() {
    this.isEditing = false;
    this.editingBookId = null;
    this.bookForm.reset({ 
      type: 'PAID_EBOOK', 
      price: 0, 
      status: 'PUBLISHED', 
      genre: 'Fiction',
      isFeatured: false,
      isBestseller: false,
      pdfUrl: ''
    });
    this.selectedFile = null;
    this.selectedCoverFile = null;
    this.coverPreview = null;
    this.showModal = true;
  }

  openEditModal(book: any) {
    this.isEditing = true;
    this.editingBookId = book.id;
    this.bookForm.patchValue({
      title: book.title,
      author: book.author,
      description: book.description,
      genre: book.genre,
      type: book.type,
      price: book.price,
      coverImageUrl: book.coverImageUrl,
      status: book.status || 'PUBLISHED',
      isFeatured: book.isFeatured || false,
      isBestseller: book.isBestseller || false,
      pdfUrl: book.pdfUrl || ''
    });
    this.selectedFile = null;
    this.selectedCoverFile = null;
    this.coverPreview = book.coverImageUrl ? this.getCoverUrl(book.coverImageUrl) : null;
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  onSubmit() {
    if (this.bookForm.valid) {
      this.isSubmitting = true;
      
      const formData = new FormData();
      
      const bookData = {
        ...this.bookForm.value,
        price: Number(this.bookForm.value.price)
      };

      // Send as a simple string to match the @RequestPart("book") String bookJson signature
      formData.append('book', JSON.stringify(bookData));
      
      if (this.selectedFile) {
        formData.append('pdf', this.selectedFile);
      }
      if (this.selectedCoverFile) {
        formData.append('coverImage', this.selectedCoverFile);
      }

      const url = this.isEditing ? `${this.baseUrl}/${this.editingBookId}` : this.baseUrl;
      const request = this.isEditing 
        ? this.http.put(url, formData)
        : this.http.post(url, formData);

      request.subscribe({
        next: (res) => {
          alert(this.isEditing ? 'Book updated successfully!' : 'Book added successfully!');
          this.fetchBooks();
          this.closeModal();
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error(`Error ${this.isEditing ? 'updating' : 'adding'} book`, err);
          alert(`Failed to ${this.isEditing ? 'update' : 'add'} book. Error: ` + (err.error?.message || err.message));
          this.isSubmitting = false;
        }
      });
    }
  }

  deleteBook(id: string) {
    if (confirm('Are you sure you want to delete this book?')) {
      this.http.delete(`${this.baseUrl}/${id}`).subscribe({
        next: () => {
          this.books = this.books.filter(b => b.id !== id);
        },
        error: (err) => console.error('Error deleting book', err)
      });
    }
  }

  getCoverUrl(url: string, bookId?: string): string {
    return this.bookService.getCoverUrl(url, bookId);
  }
}
