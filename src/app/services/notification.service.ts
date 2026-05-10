import { Injectable, inject } from '@angular/core';
import { Firestore, collection, query, where, onSnapshot, collectionData } from '@angular/fire/firestore';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Notification {
  id?: string;
  message: string;
  type: string;
  createdAt: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private firestore = inject(Firestore);
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notificationsSubject.asObservable();

  constructor() {
    this.listenToNotifications();
  }

  private listenToNotifications() {
    const notificationsRef = collection(this.firestore, 'notifications');
    const q = query(notificationsRef, where('active', '==', true));
    
    onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      // Sort by newest first
      notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.notificationsSubject.next(notifications);
    });
  }
}
