import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

@Directive({
  selector: 'img[appSecureImage]',
  standalone: true
})
export class SecureImageDirective implements OnChanges, OnDestroy {
  @Input('appSecureImage') src: string = '';
  
  private el = inject(ElementRef);
  private http = inject(HttpClient);
  private currentObjectUrl: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && this.src) {
      this.loadImage();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private cleanup() {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  private async loadImage() {
    this.cleanup();

    if (!this.src.endsWith('.vault')) {
      this.el.nativeElement.src = this.src;
      return;
    }

    try {
      const data = await lastValueFrom(this.http.get(this.src, { responseType: 'arraybuffer' }));
      if (data) {
        const decryptedData = this.decrypt(new Uint8Array(data));
        
        // Convert to Base64 (Stealth Mode - No network request)
        const base64Data = btoa(
          new Uint8Array(decryptedData)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        
        this.el.nativeElement.src = `data:image/png;base64,${base64Data}`;
      }
    } catch (error) {
      console.error('Failed to load secure image:', error);
      this.el.nativeElement.src = 'https://via.placeholder.com/300x450?text=Secure+Image+Error';
    }
  }

  private decrypt(data: Uint8Array): Uint8Array {
    const secretKey = 0x42;
    for (let i = 0; i < data.length; i++) {
      data[i] ^= secretKey;
    }
    return data;
  }
}
