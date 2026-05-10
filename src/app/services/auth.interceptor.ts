import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth, idToken } from '@angular/fire/auth';
import { switchMap, take } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  
  // Skip interceptor for public routes, Archive.org, or Google Drive requests
  if (req.url.includes('googleapis.com') || 
      req.url.includes('archive.org') || 
      req.url.includes('googleusercontent.com') ||
      req.url.includes('/api/public/')) {
    return next(req);
  }

  // Use idToken observable which waits for the auth state to initialize
  return idToken(auth).pipe(
    take(1), // We only need the current token for this request
    switchMap(token => {
      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authReq);
      }
      return next(req);
    })
  );
};
