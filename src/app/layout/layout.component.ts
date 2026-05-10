import { Component, inject } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SearchService } from '../services/search.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private searchService = inject(SearchService);
  
  searchTerm = '';

  onGlobalSearch() {
    this.searchService.setSearchTerm(this.searchTerm);
    if (!this.router.url.includes('/app/library') && !this.router.url.includes('/app/favorites')) {
      this.router.navigate(['/app/library']);
    }
  }
  
  user$ = this.authService.user$;
  isSidebarOpen = false;
  isMinimized = false;

  get userName(): string {
    return this.authService.getUserDisplayName();
  }

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
  }

  closeSidebar() {
    this.isSidebarOpen = false;
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}
