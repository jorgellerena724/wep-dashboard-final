import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, Observable, take } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({
  providedIn: 'root',
})
export class LoginGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean | Observable<boolean> {
    // Usar signals para verificar estado de autenticación
    const isLoggedIn = this.authService.isLoggedInSignal();

    // Si ya está autenticado, redirigir inmediatamente
    if (isLoggedIn) {
      this.performRedirect();
      return false;
    }

    // Si la verificación inicial aún no se completa, esperar
    // Convertir el computed signal a observable para compatibilidad
    return new Observable<boolean>((subscriber) => {
      const checkInterval = setInterval(() => {
        const isInitialChecked =
          this.authService.getInitialNavigationCheckedSignal()();
        if (isInitialChecked) {
          clearInterval(checkInterval);
          const isCurrentlyLoggedIn = this.authService.isLoggedInSignal();
          if (isCurrentlyLoggedIn) {
            this.performRedirect();
            subscriber.next(false);
          } else {
            subscriber.next(true);
          }
          subscriber.complete();
        }
      }, 50);

      // Timeout por si hay problemas
      setTimeout(() => {
        clearInterval(checkInterval);
        subscriber.next(true);
        subscriber.complete();
      }, 2000);
    });
  }

  private performRedirect(): void {
    const lastPath = this.authService.getLastPath();
    const redirectPath =
      lastPath && lastPath !== '/login' && lastPath !== '/'
        ? lastPath
        : '/dashboard';

    this.router.navigateByUrl(redirectPath, { replaceUrl: true });
  }
}
