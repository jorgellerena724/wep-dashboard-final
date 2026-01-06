import {
  Injectable,
  Inject,
  PLATFORM_ID,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, throwError, Subscription } from 'rxjs';
import { catchError, map, distinctUntilChanged, filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from '../../shared/services/system/notification.service';
import { TranslocoService } from '@jsverse/transloco'; // ---> AÑADIDO: Importar TranslocoService

interface User {
  id: string;
  full_name: string;
  email: string;
  exp: number;
  client: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private redirectExecuted = false;

  // Signals para estado reactivo
  private tokenSignal = signal<string | null>(null);
  private userSignal = signal<User | null>(null);
  private initialNavigationCheckedSignal = signal<boolean>(false);

  // Computed properties para observables externos
  public initialNavigationChecked$ = computed(() =>
    this.initialNavigationCheckedSignal()
  );
  public token$ = computed(() => this.tokenSignal());
  public user$ = computed(() => this.userSignal());
  public isLoggedInSignal = computed(
    () => !!this.userSignal() && !this.checkTokenExpiration()
  );

  private inactivityTimer: any;
  private tokenExpirationTimer: any;
  private warningTimer: any;
  private lastActivityTime = Date.now();
  private isLoggingOut = false;
  private eventListenersAdded = false;
  private activityHandler: ((event: Event) => void) | null = null;
  private navigationSubscription: Subscription | null = null;

  private readonly INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutos
  private readonly WARNING_BEFORE_TIMEOUT = 1 * 60 * 1000; // 1 minuto

  // ---> AÑADIDO: Inyección de TranslocoService usando 'inject'
  private transloco = inject(TranslocoService);

  constructor(
    private http: HttpClient,
    private router: Router,
    private notificationSrv: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.loadInitialState();
    this.setupNavigationTracking();
  }

  // ... (el resto de los métodos hasta resetInactivityTimer se mantienen igual)
  private setupNavigationTracking(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.navigationSubscription = this.router.events
        .pipe(
          filter((event) => event instanceof NavigationEnd),
          distinctUntilChanged(
            (a, b) => (a as NavigationEnd).url === (b as NavigationEnd).url
          )
        )
        .subscribe((event: NavigationEnd) => {
          if (
            this.isLoggedIn() &&
            event.url !== '/login' &&
            event.url !== '/' &&
            !event.url.includes('login')
          ) {
            try {
              localStorage.setItem('lastPath', event.url);
            } catch (error) {
              console.warn('Error saving lastPath:', error);
            }
          }
        });
    }
  }

  public getLastPath(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      try {
        return localStorage.getItem('lastPath');
      } catch (error) {
        console.warn('Error getting lastPath:', error);
        return null;
      }
    }
    return null;
  }

  public clearLastPath(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.removeItem('lastPath');
      } catch (error) {
        console.warn('Error clearing lastPath:', error);
      }
    }
  }

  private setupActivityListeners(): void {
    if (isPlatformBrowser(this.platformId) && !this.eventListenersAdded) {
      const events = [
        'mousedown',
        'mousemove',
        'keypress',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'input',
        'focus',
      ];

      this.activityHandler = this.createDebouncedHandler();

      events.forEach((event) => {
        document.addEventListener(event, this.activityHandler!, {
          passive: true,
        });
      });

      this.eventListenersAdded = true;
    }
  }

  private createDebouncedHandler(): (event: Event) => void {
    let timeout: any;
    return (event: Event) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (this.user && !this.isLoggingOut) {
          this.resetInactivityTimer();
        }
      }, 1000);
    };
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private cleanup(): void {
    if (this.navigationSubscription) {
      this.navigationSubscription.unsubscribe();
      this.navigationSubscription = null;
    }

    if (
      isPlatformBrowser(this.platformId) &&
      this.eventListenersAdded &&
      this.activityHandler
    ) {
      const events = [
        'mousedown',
        'mousemove',
        'keypress',
        'keydown',
        'scroll',
        'touchstart',
        'click',
        'input',
        'focus',
      ];

      events.forEach((event) => {
        document.removeEventListener(event, this.activityHandler!);
      });

      this.eventListenersAdded = false;
      this.activityHandler = null;
    }

    this.clearAllTimers();
  }

  private clearAllTimers(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }

    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }
  }

  public loadInitialState(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const sessionToken = localStorage.getItem('token');
        const sessionUser = localStorage.getItem('user');

        if (sessionToken && sessionUser) {
          const user = JSON.parse(sessionUser) as User;

          if (user.exp && Date.now() >= user.exp) {
            this.logout(false); // No mostrar notificación al iniciar la app
            this.initialNavigationCheckedSignal.set(true);
            return;
          }

          this.tokenSignal.set(sessionToken);
          this.userSignal.set(user);
          this.setupExpirationTimer(user.exp);
          this.setupActivityListeners();
          this.resetInactivityTimer();

          if (!this.redirectExecuted) {
            this.redirectExecuted = true;
            this.redirectAfterLogin();
          }
        } else {
          this.initialNavigationCheckedSignal.set(true);
        }
      } catch (error) {
        console.error('Error loading initial state:', error);
        this.logout(false); // No mostrar notificación al iniciar la app
        this.initialNavigationCheckedSignal.set(true);
      }
    } else {
      this.initialNavigationCheckedSignal.set(true);
    }
  }

  private decodeToken(token: string): User | null {
    if (!token) {
      return null;
    }
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) {
        return null;
      }
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const fullUser = JSON.parse(jsonPayload);
      const exp = fullUser.exp * 1000;
      const full_name = fullUser.full_name;
      const email = fullUser.email;
      const client = fullUser.client;
      const id = fullUser.id || fullUser.user_id || fullUser._id || email;

      return { id, full_name, email, exp, client };
    } catch (error) {
      console.error('Error decodificando token:', error);
      return null;
    }
  }

  public checkTokenExpiration(): boolean {
    const user = this.userSignal();
    if (user?.exp) {
      const currentTime = Date.now();
      return currentTime >= user.exp;
    }
    return false;
  }

  private setupExpirationTimer(expirationTime: number): void {
    if (this.tokenExpirationTimer) {
      clearTimeout(this.tokenExpirationTimer);
      this.tokenExpirationTimer = null;
    }

    const timeUntilExpiration = expirationTime - Date.now();

    if (timeUntilExpiration > 0) {
      this.tokenExpirationTimer = setTimeout(() => {
        if (!this.isLoggingOut) {
          this.CloseInactivity();
        }
      }, timeUntilExpiration);
    }
  }

  private resetInactivityTimer(): void {
    if (this.isLoggingOut) {
      return;
    }

    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);

    this.lastActivityTime = Date.now();

    this.warningTimer = setTimeout(() => {
      if (!this.isLoggingOut && this.user) {
        // MODIFICADO: Usar la clave de traducción para la advertencia de inactividad
        const warningMessage = this.transloco.translate(
          'notifications.session.inactivityWarning'
        );
        this.notificationSrv.addNotification(warningMessage, 'warning');
      }
    }, this.INACTIVITY_TIMEOUT - this.WARNING_BEFORE_TIMEOUT);

    this.inactivityTimer = setTimeout(() => {
      if (!this.isLoggingOut && this.user) {
        this.logout();
      }
    }, this.INACTIVITY_TIMEOUT);
  }

  isLoggedIn(): boolean {
    return this.isLoggedInSignal();
  }

  public login(email: string, password: string): Observable<boolean> {
    const trimmedEmail = email.trim();
    const formData = new FormData();
    formData.append('email', trimmedEmail);
    formData.append('password', password);

    return this.http
      .post<LoginResponse>(`${environment.api_security}sign-in/`, formData)
      .pipe(
        map((response: LoginResponse) => {
          if (response?.access_token) {
            const decodedToken = this.decodeToken(response.access_token);
            if (decodedToken) {
              if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem('token', response.access_token);
                localStorage.setItem('user', JSON.stringify(decodedToken));
              }
              this.tokenSignal.set(response.access_token);
              this.userSignal.set(decodedToken);
              this.setupExpirationTimer(decodedToken.exp);
              this.setupActivityListeners();
              this.resetInactivityTimer();
              return true;
            }
          }
          return false;
        }),
        catchError((errorResponse: HttpErrorResponse) => {
          console.error('Error en login:', errorResponse);
          return throwError(() => errorResponse);
        })
      );
  }

  public CloseInactivity(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.clearAllTimers();
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.cleanupAndRedirect();
  }

  public logout(showNotification: boolean = true): void {
    if (this.isLoggingOut) return;

    this.isLoggingOut = true;
    this.clearAllTimers();
    this.tokenSignal.set(null);
    this.userSignal.set(null);

    // Solo mostrar notificación si se solicita explícitamente
    if (showNotification) {
      // MODIFICADO: Usar la clave de traducción para el cierre de sesión
      const logoutMessage = this.transloco.translate(
        'notifications.session.logoutSuccess'
      );
      this.notificationSrv.addNotification(logoutMessage, 'success');
    }

    this.cleanupAndRedirect();
  }

  private cleanupAndRedirect(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        if (this.router.url !== '/login' && this.router.url !== '/') {
          localStorage.setItem('lastPath', this.router.url);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (error) {
        console.warn('Error during cleanup:', error);
      }
    }

    setTimeout(() => {
      this.router.navigate(['/login'], { replaceUrl: true });
      this.isLoggingOut = false;
    }, 0);
  }

  public updateUser(newUserData: Partial<User>): void {
    const currentUser = this.userSignal();
    if (currentUser && isPlatformBrowser(this.platformId)) {
      try {
        const updatedUser = { ...currentUser, ...newUserData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.userSignal.set(updatedUser);
      } catch (error) {
        console.warn('Error updating user:', error);
      }
    }
  }

  public get user(): User | null {
    return this.userSignal();
  }

  public get token(): string | null {
    return this.tokenSignal();
  }

  // Métodos adicionales para compatibilidad con código existente
  public getUserSignal() {
    return this.userSignal;
  }

  public getTokenSignal() {
    return this.tokenSignal;
  }

  public getInitialNavigationCheckedSignal() {
    return this.initialNavigationCheckedSignal;
  }

  public redirectAfterLogin(): void {
    if (isPlatformBrowser(this.platformId) && this.isLoggedIn()) {
      setTimeout(() => {
        const lastPath = this.getLastPath();
        if (
          lastPath &&
          lastPath !== '/login' &&
          lastPath !== '/' &&
          !lastPath.includes('login')
        ) {
          this.router.navigateByUrl(lastPath, { replaceUrl: true });
        } else {
          this.router.navigate(['/admin'], { replaceUrl: true });
        }
        this.initialNavigationCheckedSignal.set(true);
      }, 100);
    } else {
      this.initialNavigationCheckedSignal.set(true);
    }
  }

  public getClient(): string | null {
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        return user.client || null;
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    }
    return null;
  }
}
