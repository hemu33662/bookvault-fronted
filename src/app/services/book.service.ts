import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BookService {

  constructor() { }

  /**
   * Transforms a URL into a secure Vault link or proxy link.
   */
  getCoverUrl(url: string, bookId?: string): string {
    if (!url) return '';

    // Force all assets into the Secure Vault if bookId is available
    if (bookId) {
      // If it's already an upload, use its name. Otherwise, create a virtual name.
      const fileName = url.startsWith('/uploads/') ? 
                       url.replace('/uploads/', '') : 
                       (url.toLowerCase().includes('pdf') ? 'book.vault' : 'cover.vault');
      
      return `${environment.apiUrl}/vault/${bookId}/${fileName}`;
    }

    // Fallback for when bookId isn't available (e.g. legacy components)
    if (url.startsWith('/uploads/')) {
      const apiBase = environment.apiUrl.replace('/api', '');
      return `${apiBase}${url}`;
    }
    
    // Last resort: If no bookId and not local, use the old proxy logic (only for public thumbs)
    if (url.includes('drive.google.com')) {
      const fileId = this.extractDriveId(url);
      if (fileId) {
        return `${environment.apiUrl}/public/proxy?url=${encodeURIComponent(`https://drive.google.com/thumbnail?id=${fileId}&sz=w600`)}`;
      }
    }
    
    return url;
  }

  private extractDriveId(url: string): string | null {
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (driveMatch) return driveMatch[1];
    
    const openMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (openMatch) return openMatch[1];
    
    const ucMatch = url.match(/drive\.google\.com\/uc\?.*id=([^&]+)/);
    if (ucMatch) return ucMatch[1];
    
    return null;
  }

  getSecurePdfUrl(url: string, bookId: string): string {
    if (!url) return '';
    
    // If it's already an upload, use the secure vault
    if (url.startsWith('/uploads/')) {
      const fileName = url.replace('/uploads/', '');
      return `${environment.apiUrl}/vault/${bookId}/${fileName}`;
    }

    // If it's a Drive or Archive.org link, force it through the vault so it gets captured and secured
    if (url.includes('drive.google.com') || url.includes('archive.org')) {
      return `${environment.apiUrl}/vault/${bookId}/book.vault`;
    }

    return url;
  }
}
