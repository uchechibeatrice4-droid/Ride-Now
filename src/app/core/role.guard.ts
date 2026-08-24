import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(
    private fireAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {

    const requiredRole = route.data['role'];

    return this.fireAuth.authState.pipe(
      switchMap(user => {

        if (!user) {
          this.router.navigate(['/login']);
          return of(false);
        }

        return this.firestore
          .collection('users')
          .doc(user.uid)
          .valueChanges()
          .pipe(
            map((profile: any) => {

              if (profile && profile.role === requiredRole) {
                return true;
              }

              this.router.navigate(['/login']);
              return false;
            }),
            catchError(() => {
              this.router.navigate(['/login']);
              return of(false);
            })
          );
      })
    );
  }
}