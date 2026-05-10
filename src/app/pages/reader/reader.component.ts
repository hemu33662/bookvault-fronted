import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpEventType, HttpResponse, HttpProgressEvent } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BookService } from '../../services/book.service';
import * as pdfjsLib from 'pdfjs-dist';
import { environment } from '../../../environments/environment';

// Configure PDF.js worker with a reliable CDN link
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

@Component({
  selector: 'app-reader',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reader.component.html',
  styleUrl: './reader.component.css'
})
export class ReaderComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('bookContainer') bookContainer!: ElementRef;
  
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  user$!: Observable<any>;
  private http = inject(HttpClient);
  private authService = inject(AuthService) as any;
  private bookService = inject(BookService);
  private cdr = inject(ChangeDetectorRef);
  private apiUrl = environment.apiUrl;

  bookId: string | null = null;
  book: any = null;
  private isLowMemoryMode = false;
  
  currentPageIndex = 0;
  totalPages = 0;
  isLoaded = false;
  isLoading = true;
  loadingProgress = 0;
  loadingStatus = 'Initializing...';
  isFullScreen = false;
  private isBypassMode = false;
  private authToken: string | null = null;
  isPinnedAnimating = false;
  isFlipping = false;
  flipDirection: 'next' | 'prev' = 'next';
  isLocalCached = false;
  isSavingToCache = false;

  // Floating Menu State
  menuX = 30; // Initial position: Top-Left
  menuY = 90; 
  isDragging = false;
  isMenuExpanded = false;
  private dragStartX = 0;
  private dragStartY = 0;

  // Jump Dialog State
  isJumpDialogOpen = false;
  jumpPageNumber = 1;
  
  private pdfDoc: any;
  private destroy$ = new Subject<void>();
  private pageRenderStatus = new Map<number, boolean>(); // index -> isRendering
  public renderedPages = new Set<number>(); // Set of rendered page indices
  


  // Named listeners for proper cleanup
  private contextMenuListener = (e: MouseEvent) => e.preventDefault();
  private keyDownListener = (e: KeyboardEvent) => {
    // Navigation
    if (e.key === 'ArrowRight') this.nextPage();
    if (e.key === 'ArrowLeft') this.prevPage();

    // Security: Disable keyboard shortcuts for copy/save
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 's' || e.key === 'p' || e.key === 'a')) {
      e.preventDefault();
    }
  };

  ngOnInit(): void {
    this.user$ = this.authService.user$;
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.bookId = this.route.snapshot.paramMap.get('id');
      if (this.bookId) {
        this.fetchBookDetails();
        this.loadPinnedPage();
      }
    });
    // Check backend connectivity on startup
    this.checkBackendHealth();
    
    // 2. Capture Auth Token for Secure Vault Access
    this.authService.user$.pipe(takeUntil(this.destroy$)).subscribe(async (user: any) => {
      if (user) {
        this.authToken = await user.getIdToken();
      }
    });

    // Security: Disable right-click globally in the reader
    document.addEventListener('contextmenu', this.contextMenuListener);
    // Security & Navigation: Keyboard listeners
    document.addEventListener('keydown', this.keyDownListener);
  }

  private async getAuthToken(): Promise<string> {
    if (this.authToken) return this.authToken;
    
    // Wait for token to be available (max 5 seconds)
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const interval = setInterval(async () => {
        if (this.authToken) {
          clearInterval(interval);
          resolve(this.authToken);
        }
        attempts++;
        if (attempts > 50) {
          clearInterval(interval);
          reject(new Error('Authentication timeout. Please refresh.'));
        }
      }, 100);
    });
  }

  ngAfterViewInit(): void {
    // Content is loaded dynamically
  }

  ngOnDestroy(): void {

    // Global listener cleanup - MUST use named functions
    document.removeEventListener('contextmenu', this.contextMenuListener);
    document.removeEventListener('keydown', this.keyDownListener);
    
    // Destroy PDF document to free up memory
    if (this.pdfDoc) {
      this.pdfDoc.destroy();
      this.pdfDoc = null;
    }

    this.destroy$.next();
    this.destroy$.complete();
    
    // Hint to GC
    this.book = null;
  }

  fetchBookDetails(): void {
    if (this.bookId === 'test-mode') {
      // Production Secure Archive: When Silence Becomes the Answer
      // This key points to your encrypted .vault file on Archive.org
      const secureArchiveKey = 'aHR0cHM6Ly9hcmNoaXZlLm9yZy9kb3dubG9hZC93aGVuLXNpbGVuY2UtYmVjb21lcy10aGUtYW5zd2VyLi5wZGYvV2hlbiUyMHNpbGVuY2UlMjBiZWNvbWVzJTIwdGhlJTIwYW5zd2VyLi5wZGYudmF1bHQ=';
      const decodedUrl = atob(secureArchiveKey);
      
      this.resolveAndLoad(decodedUrl);
      this.book = { title: 'When Silence Becomes the Answer', author: 'Mushik' };
      return;
    }
    
    this.http.get<any>(`${this.apiUrl}/public/books/${this.bookId}`).subscribe({
      next: (data) => {
        this.book = data;
        
        // Log reading activity for the dashboard
        this.authService.user$.subscribe((user: any) => {
          if (user && user.uid && this.bookId) {
            this.logReadActivity(user.uid, user.displayName || 'User', this.bookId);
          }
        });

        if (data.pdfUrl) {
          const secureUrl = this.bookService.getSecurePdfUrl(data.pdfUrl, this.bookId!);
          this.resolveAndLoad(secureUrl);
        } else {
          this.handleLoadingError(new Error('No PDF URL found for this book.'));
        }
      },
      error: () => {
        this.book = { title: 'Local Test Mode', author: 'Developer' };
        // Fallback to a small test file if it exists, otherwise show error
        this.loadPdf('/assets/sample.pdf');
      }
    });
  }

  resolveAndLoad(url: string): void {
    if (url.includes('/vault/')) {
      this.loadPdf(url);
      return;
    }

    let finalUrl = url;
    
    // Auto-detect and optimize for Google Drive links
      const driveId = this.extractDriveId(url);
      if (driveId) {
        finalUrl = `https://lh3.googleusercontent.com/d/${driveId}`;
      }
      this.loadPdf(this.wrapInProxy(finalUrl));
      return;

    // Auto-detect and optimize for Archive.org links
    if (url.includes('archive.org')) {
      this.resolveArchiveUrl(url);
      return;
    }
    
    this.loadPdf(this.wrapInProxy(finalUrl));
  }

  private resolveArchiveUrl(url: string): void {
    this.isLoading = true;
    this.loadingProgress = 5;
    
    const cleanUrl = url.trim();

    // Check if it's already a direct download link (e.g., ends with .pdf or .vault and has the download pattern)
    // Format: archive.org/download/identifier/filename
    const directDownloadMatch = cleanUrl.match(/archive\.org\/download\/([^/]+)\/([^?#]+)/);
    
    if (directDownloadMatch) {
      const identifier = directDownloadMatch[1];
      const filename = directDownloadMatch[2];
      
      const proxyUrl = `${this.apiUrl}/public/proxy?url=${encodeURIComponent(cleanUrl)}`;
      this.loadPdf(proxyUrl);
      return;
    }

    // Otherwise, try to resolve via Metadata API
    let identifier = '';
    const detailsMatch = cleanUrl.match(/archive\.org\/details\/([^/?#\s]+)/);
    const downloadIdMatch = cleanUrl.match(/archive\.org\/download\/([^/?#\s]+)/);
    
    if (detailsMatch) identifier = detailsMatch[1].trim();
    else if (downloadIdMatch) identifier = downloadIdMatch[1].trim();
    else {
      const parts = cleanUrl.split('/');
      identifier = (parts[parts.length - 1] || parts[parts.length - 2]).trim();
    }

    if (!identifier || identifier.includes('.')) {
      // If identifier has a dot, it might be a partial path, try to clean it
      identifier = identifier.split('.')[0];
    }

    const metadataUrl = `https://archive.org/metadata/${identifier}`;
    this.http.get<any>(metadataUrl).subscribe({
      next: (metadata) => {
        if (metadata && metadata.files) {
          const vaultFile = metadata.files.find((f: any) => f.name.endsWith('.vault'));
          const pdfFile = metadata.files.find((f: any) => f.name.endsWith('.pdf'));
          const targetFile = vaultFile || pdfFile;

          if (targetFile) {
            const rawName = targetFile.name;
            const downloadUrl = `https://archive.org/download/${identifier}/${rawName}`;
            this.loadPdf(this.wrapInProxy(downloadUrl));
          } else {
            console.warn('No suitable file found in metadata, trying direct load...');
            this.loadPdf(this.wrapInProxy(url));
          }
        } else {
          this.loadPdf(this.wrapInProxy(url));
        }
      },
      error: (err) => {
        console.warn('Metadata resolution failed:', err);
        this.loadPdf(this.wrapInProxy(url));
      }
    });
  }

  private wrapInProxy(url: string): string {
    if (url.startsWith('http') && !url.includes(this.apiUrl)) {
      return `${this.apiUrl}/public/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
  }

  async loadPdf(url: string): Promise<void> {
    this.isLoading = true;
    this.loadingProgress = 5;
    this.loadingStatus = 'Connecting to Archive...';
    this.isEncryptedFile = false; // Default to false (safe)
    
    try {
      // 1. Check Local Cache First
      if (this.bookId) {
        const cachedData = await this.getCachedBook(this.bookId);
        if (cachedData) {
          this.isLocalCached = true;
          this.initializePdfEngine(cachedData);
          return;
        }
      }
      
      let total = 0;
      let acceptRanges = false;
      
      try {
        const preflightResponse = await fetch(url, { 
          headers: { 'Range': 'bytes=0-5' } // Fetch first few bytes to check encryption
        });
        
        if (!preflightResponse.ok) {
          throw new Error(`Preflight check failed with status ${preflightResponse.status}`);
        }
        
        const contentRange = preflightResponse.headers.get('content-range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          if (match) total = parseInt(match[1], 10);
          acceptRanges = preflightResponse.status === 206;
        } else {
          total = parseInt(preflightResponse.headers.get('content-length') || '0', 10);
        }

        // Detect encryption immediately during pre-flight WITHOUT downloading the whole file
        const reader = preflightResponse.body?.getReader();
        if (reader) {
          const { value, done } = await reader.read();
          if (value) {
            this.checkEncryption(value);
            // If it's a small file and already finished during pre-flight, use it directly
            if (done && preflightResponse.status === 200) {
              const finalData = this.isEncryptedFile ? this.decryptVaultData(value) : value;
              this.initializePdfEngine(finalData);
              if (this.bookId) this.saveToCache(this.bookId, finalData);
              return;
            }
          }
          // Close the preflight reader to avoid downloading the whole file if we only wanted the head
          if (!done) {
            reader.cancel().catch(() => {});
          }
        }
        
      } catch (e) {
        console.warn('Pre-flight check failed or interrupted, attempting direct stream...');
      }

      // 4. Decide: Vault/Encrypted (Manual Fetch with Auth) vs Public (Direct Stream)
      const isVaultFile = url.includes('/vault/') || url.endsWith('.vault');

      if (this.isEncryptedFile || isVaultFile) {
        this.loadingStatus = 'Accessing secure vault...';
        
        // Try parallel if large enough and supported
        if (total > 5 * 1024 * 1024 && (acceptRanges || url.includes('/proxy'))) {
          try {
            const decryptedBuffer = await this.downloadParallel(url, total);
            this.initializePdfEngine(decryptedBuffer);
            if (this.bookId) this.saveToCache(this.bookId, decryptedBuffer);
            return;
          } catch (parallelErr) {
            console.error('Parallel download failed:', parallelErr);
          }
        }

        // Default sequential download for vaulted/encrypted
        await this.downloadSequential(url, total);
        return;
      }

      // 5. Public Direct Stream (No special auth needed or PDF.js handles it)
      this.initializePdfEngine(url);

    } catch (err: any) {
      // Automatic Fallback: If proxy fails (e.g., 500 error), try direct access to the URL
      // But ONLY if it's not already a direct external URL (to avoid infinite loops)
      if (url.includes('/proxy?url=')) {
        try {
          const originalUrl = decodeURIComponent(url.split('url=')[1]);
          console.warn('Proxy failed, attempting direct bypass to:', originalUrl);
          this.isBypassMode = true; 
          await this.loadPdf(originalUrl);
          return;
        } catch (fallbackErr) {
          console.error('Direct fallback also failed:', fallbackErr);
        }
      }

      console.error(`Archive access failed for ${url}:`, err);
      this.handleLoadingError(err);
    }
  }

  private async downloadParallel(url: string, total: number): Promise<Uint8Array> {
    const decryptedBuffer = new Uint8Array(total);
    const chunkSize = 5 * 1024 * 1024; // 5MB chunks - much faster for 100MB+ files
    const concurrency = 6; // Standard concurrency for modern browsers
    const totalChunks = Math.ceil(total / chunkSize);
    let chunksLoaded = 0;
    const secretKey = 0x42;

    const downloadChunk = async (chunkIndex: number) => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize - 1, total - 1);
      
      const headers: any = { 'Range': `bytes=${start}-${end}` };
      
      // Only add Authorization if it's our own API
      if (url.includes(this.apiUrl)) {
        const token = await this.getAuthToken().catch(() => null);
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, { headers });
      
      if (response.status !== 206) {
        throw new Error(`Server did not return partial content (Status: ${response.status})`);
      }
      
      const chunkBuffer = await response.arrayBuffer();
      const chunkData = new Uint8Array(chunkBuffer);
      
      if (this.isEncryptedFile) {
        // Fast synchronous decryption for small-ish chunks (5MB is fine)
        const secretKey = 0x42;
        for (let i = 0; i < chunkData.length; i++) chunkData[i] ^= secretKey;
      }

      // Safety check: Ensure chunk fits in buffer
      if (start + chunkData.length > decryptedBuffer.length) {
        throw new Error(`Parallel chunk out of bounds: ${start + chunkData.length} > ${decryptedBuffer.length}`);
      }

      decryptedBuffer.set(chunkData, start);
      chunksLoaded++;
      this.loadingProgress = 10 + Math.round((chunksLoaded / totalChunks) * 85);
      this.loadingStatus = `Securing Chunks (${chunksLoaded}/${totalChunks})...`;
      this.cdr.detectChanges();
    };

    // Simple Pool
    const queue = Array.from({ length: totalChunks }, (_, i) => i);
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queue.length > 0) {
        const index = queue.shift()!;
        await downloadChunk(index);
      }
    });

    await Promise.all(workers);
    return decryptedBuffer;
  }

  private isEncryptedFile = false;
  private checkEncryption(data: Uint8Array): void {
    if (data.length < 4) return;
    
    const secretKey = 0x42;
    // Search for %PDF (0x25 0x50 0x44 0x46) in the first 1KB of data
    const searchRange = Math.min(data.length, 1024);
    let pdfOffset = -1;
    let xorPdfOffset = -1;

    for (let i = 0; i <= searchRange - 4; i++) {
      if (data[i] === 0x25 && data[i+1] === 0x50 && data[i+2] === 0x44 && data[i+3] === 0x46) {
        pdfOffset = i;
        break;
      }
      if ((data[i]^secretKey) === 0x25 && (data[i+1]^secretKey) === 0x50 && (data[i+2]^secretKey) === 0x44 && (data[i+3]^secretKey) === 0x46) {
        xorPdfOffset = i;
        break;
      }
    }

    if (pdfOffset !== -1) {
      this.isEncryptedFile = false;
      console.log('📄 Standard PDF detected');
    } else if (xorPdfOffset !== -1) {
      this.isEncryptedFile = true;
      console.log('🛡️ Secure Vault detected (XOR)');
    } else {
      // Default to false if we can't verify it's a vault
      console.warn('⚠️ Unknown file type or corrupted data. This might not be a valid PDF.');
      this.isEncryptedFile = false;
    }
  }

  private async downloadSequential(url: string, total: number): Promise<void> {
    const headers: any = {};
    
    // Only add Authorization if it's our own API
    if (url.includes(this.apiUrl)) {
      const token = await this.getAuthToken().catch(() => null);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    let loaded = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Failed reader');

    let buffer = total > 0 ? new Uint8Array(total) : new Uint8Array(0);
    const secretKey = 0x42;
    let firstCheck = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstCheck) {
        this.checkEncryption(value);
        if (value.length >= 4) firstCheck = true;
      }

      if (this.isEncryptedFile) {
        await this.decryptChunkAsync(value);
      }

      // Robust buffer management: Handle cases where total is wrong or missing (e.g. gzip compression)
      if (total > 0 && loaded + value.length <= buffer.length) {
        buffer.set(value, loaded);
      } else {
        // Fallback to dynamic growth
        const newBuffer = new Uint8Array(loaded + value.length);
        if (buffer.length > 0) {
          // Copy existing data up to current loaded offset
          newBuffer.set(buffer.subarray(0, loaded));
        }
        newBuffer.set(value, loaded);
        buffer = newBuffer;
        
        if (total > 0 && loaded + value.length > total) {
          console.warn(`⚠️ Streaming data (${loaded + value.length}) exceeded expected size (${total}). Resizing buffer...`);
        }
      }

      loaded += value.length;
      if (total > 0) {
        this.loadingProgress = 10 + Math.round((loaded / total) * 85);
        this.cdr.detectChanges();
      }
    }

    this.initializePdfEngine(buffer);
    // Note: Caching is now handled inside initializePdfEngine after successful validation
  }

  private async decryptChunkAsync(chunk: Uint8Array): Promise<void> {
    const secretKey = 0x42;
    // For smaller chunks, do it synchronously to save time
    if (chunk.length < 5 * 1024 * 1024) {
      for (let i = 0; i < chunk.length; i++) chunk[i] ^= secretKey;
      return;
    }
    
    // For very large chunks, process in batches to keep UI responsive
    const batchSize = 1024 * 1024; // 1MB batches
    for (let i = 0; i < chunk.length; i += batchSize) {
      const end = Math.min(i + batchSize, chunk.length);
      for (let j = i; j < end; j++) {
        chunk[j] ^= secretKey;
      }
      if (i % (batchSize * 2) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  private initializePdfEngine(data: Uint8Array | string): void {
    this.loadingProgress = 100;
    this.loadingStatus = 'Preparing Archive...';
    this.cdr.detectChanges();
    
    const isBuffer = data instanceof Uint8Array;
    
    if (isBuffer) {
      // Diagnostic for Buffers
    } else {
    }

    // Configure loading task
    // If it's a URL (string), we ENABLE range requests and streaming for efficiency.
    // If it's a Buffer (Uint8Array), we must disable them.
    const loadingTask = pdfjsLib.getDocument(isBuffer ? {
      data: data.buffer,
      disableRange: true,
      disableStream: true,
      isEvalSupported: false
    } : {
      url: data,
      disableRange: false,
      disableStream: false,
      isEvalSupported: false
    });
    
    loadingTask.promise.then(async (pdf) => {
      this.pdfDoc = pdf;
      this.totalPages = pdf.numPages;
      this.isLoaded = true;
      this.loadingStatus = 'Rendering...';
      this.cdr.detectChanges();

      // Instant Open: Render current page first
      await this.renderPageToCanvas(this.currentPageIndex);
      this.isLoading = false;
      this.cdr.detectChanges();
      
      // Background pre-render
      this.preRenderNearbyPages();

      // Save to cache ONLY IF it's a valid PDF and we have data
      if (this.bookId && isBuffer && data.length > 1024) {
        setTimeout(() => this.saveToCache(this.bookId!, data), 1000);
      }
    }).catch(async (err) => {
      console.error('PDF.js failed:', err);
      
      // DIAGNOSTIC: Log the first few bytes of the data that failed
      if (isBuffer) {
        const header = Array.from(data.subarray(0, 16))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(' ');
        const text = new TextDecoder().decode(data.subarray(0, 100));
        console.log('🔍 Diagnostic - Data Header (Hex):', header);
        console.log('🔍 Diagnostic - Data Preview (Text):', text);
      }

      // If it's an InvalidPDFException and we were loading from cache, clear the cache!
      if (err.name === 'InvalidPDFException' && this.isLocalCached) {
        console.warn('🗑️ Corrupted local cache detected. Clearing...');
        this.clearLocalCache(false); // Clear silently
        // Try reloading from server
        if (typeof data !== 'string') {
          this.fetchBookDetails(); 
          return;
        }
      }

      // Automatic Bypass: If proxied URL fails (e.g., 500 from gateway), try direct link
      if (!this.isBypassMode && typeof data === 'string' && data.includes('/proxy?url=')) {
        try {
          const originalUrl = decodeURIComponent(data.split('url=')[1]);
          this.loadingStatus = 'Bypassing Gateway...';
          this.isBypassMode = true; // Mark that we are already trying to bypass
          this.cdr.detectChanges();
          
          // Re-initialize with original URL
          this.initializePdfEngine(originalUrl);
          return;
        } catch (fallbackErr) {
          console.error('Direct bypass also failed:', fallbackErr);
        }
      }
      
      this.handleLoadingError(err);
    });
  }

  // --- IndexedDB Local Vault Cache ---
  private async getCachedBook(id: string): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('BookVaultCache', 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books');
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const transaction = db.transaction('books', 'readonly');
        const store = transaction.objectStore('books');
        const getRequest = store.get(id);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  }

  private async saveToCache(id: string, data: Uint8Array): Promise<void> {
    this.isSavingToCache = true;
    this.cdr.detectChanges();
    
    const request = indexedDB.open('BookVaultCache', 1);
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const transaction = db.transaction('books', 'readwrite');
      const store = transaction.objectStore('books');
      store.put(data, id);
      transaction.oncomplete = () => {
        this.isSavingToCache = false;
        this.isLocalCached = true;
        this.cdr.detectChanges();
      };
    };
  }

  clearLocalCache(showAlert: boolean = true): void {
    if (this.bookId) {
      const request = indexedDB.open('BookVaultCache', 1);
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const transaction = db.transaction('books', 'readwrite');
        transaction.objectStore('books').delete(this.bookId!);
        transaction.oncomplete = () => {
          this.isLocalCached = false;
          if (showAlert) {
            alert('Local cache cleared. Next time this book will load from the server.');
          }
          this.cdr.detectChanges();
        };
      };
    }
  }

  // The "Unscrambler" - Uses a secret key to restore the PDF data
  private decryptVaultData(data: Uint8Array): Uint8Array {
    const secretKey = 0x42; // Same key used to "scramble" the file
    const decrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      decrypted[i] = data[i] ^ secretKey; // XOR Decryption
    }
    return decrypted;
  }

  private handleLoadingError(err?: any): void {
    console.error('Archive access failed:', err);
    this.isLoading = false;
    this.loadingProgress = 0;
    
    // Automatic redirection for auth errors
    if (err?.status === 401) {
      console.warn('Unauthorized access, redirecting to login...');
      this.router.navigate(['/login']);
      return;
    }
    
    if (err?.status === 403) {
      console.warn('Access denied, redirecting to library...');
      alert('Access Denied: You do not own this book or purchase is required.');
      this.router.navigate(['/app/library']);
      return;
    }

    let errorMsg = 'Archive access failed.';
    if (err?.message) errorMsg += `\nError: ${err.message}`;
    if (this.apiUrl.includes('your-bookvault-backend')) {
      errorMsg += '\n\n⚠️ CONFIGURATION ERROR: Your apiUrl in environment.ts is still set to a placeholder. Please update it to your actual backend URL.';
    }
    
    alert(errorMsg + '\n\nThis might be due to a CORS policy restriction, a broken link, or the backend being unreachable.');
  }

  private checkBackendHealth(): void {
    if (this.apiUrl.includes('your-bookvault-backend')) {
      console.error('CRITICAL: apiUrl is set to a placeholder!');
    }
    this.http.get(`${this.apiUrl}/public/books`, { observe: 'response' }).subscribe({
      error: (err) => {
        console.warn('Backend health check failed. Reader may not work correctly.', err);
      }
    });
  }

  private async preRenderNearbyPages(): Promise<void> {
    const range = [this.currentPageIndex + 1, this.currentPageIndex - 1];
    for (const index of range) {
      if (index >= 0 && index < this.totalPages) {
        this.renderPageToCanvas(index);
      }
    }
  }

  async renderPageToCanvas(index: number, force: boolean = false): Promise<void> {
    if (!this.pdfDoc || (this.renderedPages.has(index) && !force) || this.pageRenderStatus.get(index)) return;
    
    this.pageRenderStatus.set(index, true);
    
    try {
      const page = await this.pdfDoc.getPage(index + 1);
      
      // We render to specific canvases: current-page, next-page, prev-page
      // Or we use a dynamic lookup. For flip 2.0, we'll use IDs
      let canvasId = `page-canvas-${index}`;
      let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      
      // Fallback for pre-rendering off-screen
      if (!canvas) {
        // If not in DOM yet (like next page), we might need to wait or use a buffer canvas
        // In the flip design, we'll ensure they exist in the DOM but hidden
        this.pageRenderStatus.set(index, false);
        return;
      }

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      
      // Extreme Density: Render at 200% of display size for absolute sharpness
      const container = canvas.parentElement;
      const displayHeight = container?.clientHeight || window.innerHeight * 0.95;
      
      const baseViewport = page.getViewport({ scale: 1.0 });
      // Scale = (Display Height / Base PDF Height) * DPR * 2 (Super-sampling)
      const overSampledScale = (displayHeight / baseViewport.height) * dpr * 2.0;
      
      const viewport = page.getViewport({ scale: overSampledScale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      await page.render({ 
        canvasContext: context, 
        viewport: viewport,
        intent: 'print', // Print intent is sharper for text
        enableWebGL: true
      }).promise;
      this.renderedPages.add(index);
      this.pageRenderStatus.set(index, false);
      this.cdr.detectChanges();
    } catch (e) {
      console.error(`Failed to render page ${index}`, e);
      this.pageRenderStatus.set(index, false);
    }
  }

  async nextPage(): Promise<void> {
    if (this.currentPageIndex < this.totalPages - 1 && !this.isFlipping) {
      // Ensure next page is rendered before flipping
      if (!this.renderedPages.has(this.currentPageIndex + 1)) {
        await this.renderPageToCanvas(this.currentPageIndex + 1);
      }
      
      this.flipDirection = 'next';
      this.isFlipping = true;
      this.cdr.detectChanges();
      
      // Sync update half-way through 1.2s animation
      setTimeout(() => {
        this.currentPageIndex++;
        this.preRenderNearbyPages();
      }, 600);
      
      setTimeout(() => {
        this.isFlipping = false;
        this.cdr.detectChanges();
      }, 1200);
    }
  }

  async prevPage(): Promise<void> {
    if (this.currentPageIndex > 0 && !this.isFlipping) {
      if (!this.renderedPages.has(this.currentPageIndex - 1)) {
        await this.renderPageToCanvas(this.currentPageIndex - 1);
      }
      
      this.flipDirection = 'prev';
      this.isFlipping = true;
      this.cdr.detectChanges();
      
      setTimeout(() => {
        this.currentPageIndex--;
        this.preRenderNearbyPages();
      }, 600);
      
      setTimeout(() => {
        this.isFlipping = false;
        this.cdr.detectChanges();
      }, 1200);
    }
  }

  confirmJump(): void {
    const targetIndex = this.jumpPageNumber - 1;
    if (targetIndex >= 0 && targetIndex < this.totalPages) {
      this.isLoading = true;
      this.loadingStatus = 'Jumping...';
      this.currentPageIndex = targetIndex;
      this.renderedPages.clear(); // Clear to force fresh render of target
      
      this.renderPageToCanvas(this.currentPageIndex).then(() => {
        this.isLoading = false;
        this.preRenderNearbyPages();
        this.cdr.detectChanges();
      });
      
      this.isJumpDialogOpen = false;
    }
  }

  pinPage(): void {
    if (this.bookId) {
      localStorage.setItem(`pinned_page_${this.bookId}`, this.currentPageIndex.toString());
      
      // Visual feedback animation
      this.isPinnedAnimating = true;
      setTimeout(() => this.isPinnedAnimating = false, 600);
      
    }
  }

  toggleFullScreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      this.isFullScreen = true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        this.isFullScreen = false;
      }
    }
  }

  loadPinnedPage(): void {
    if (this.bookId) {
      const savedPage = localStorage.getItem(`pinned_page_${this.bookId}`);
      if (savedPage) {
        this.currentPageIndex = parseInt(savedPage, 10);
      }
    }
  }

  // Floating Menu & Dragging Logic
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isMenuExpanded = !this.isMenuExpanded;
  }

  startDragging(event: MouseEvent): void {
    this.isDragging = true;
    this.dragStartX = event.clientX - this.menuX;
    this.dragStartY = event.clientY - this.menuY;
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (this.isDragging) {
        this.menuX = moveEvent.clientX - this.dragStartX;
        this.menuY = moveEvent.clientY - this.dragStartY;
        this.cdr.detectChanges();
      }
    };

    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  openJumpDialog(event: MouseEvent): void {
    event.stopPropagation();
    this.isJumpDialogOpen = true;
    this.isMenuExpanded = false;
    this.jumpPageNumber = this.currentPageIndex + 1;
  }

  private logReadActivity(userId: string, userName: string, bookId: string): void {
    const activity = {
      userName: userName,
      action: 'READ_BOOK',
      detail: this.bookId || bookId // Use bookId from the route if available
    };

    this.http.post(`${this.apiUrl}/dashboard/log-activity`, activity).subscribe({
      error: (err) => {} // Silently ignore logging errors to not disrupt reading
    });
  }

  closeReader(): void {
    this.router.navigate(['/app/library']);
  }

  extractDriveId(url: string): string | null {
    if (!url) return null;
    return url.match(/\/d\/([^/]+)/)?.[1] || url.match(/id=([^&]+)/)?.[1] || null;
  }
}
