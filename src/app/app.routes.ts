import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { LayoutComponent } from './layout/layout.component';
import { ReaderComponent } from './pages/reader/reader.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HomeComponent } from './pages/home/home.component';
import { AdminDashboardComponent } from './pages/admin/dashboard/dashboard.component';
import { UserManagementComponent } from './pages/admin/user-management/user-management.component';
import { OrderManagementComponent } from './pages/admin/order-management/order-management.component';
import { AdminLayoutComponent } from './pages/admin/admin-layout/admin-layout.component';
import { BookManagementComponent } from './pages/admin/book-management/book-management.component';
import { SecurityDashboardComponent } from './pages/admin/security-dashboard/security-dashboard.component';
import { LibraryComponent } from './pages/library/library.component';
import { OrdersComponent } from './pages/orders/orders.component';
import { NotificationsComponent } from './pages/notifications/notifications.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'reader/:id', component: ReaderComponent, canActivate: [authGuard] },
  { path: '', component: HomeComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'books', component: BookManagementComponent },
      { path: 'users', component: UserManagementComponent },
      { path: 'orders', component: OrderManagementComponent },
      { path: 'security', component: SecurityDashboardComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'app',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'library', component: LibraryComponent },
      { path: 'favorites', component: LibraryComponent }, // Using Library for Favorites for now
      { path: 'orders', component: OrdersComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: '', redirectTo: 'library', pathMatch: 'full' }
    ]
  }
];
