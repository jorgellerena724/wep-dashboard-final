import { Component, inject, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { HttpErrorResponse } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [ReactiveFormsModule, TranslocoModule],
  standalone: true,
})
export class LoginComponent {
  // --- Inyección de dependencias ---
  // Se mantiene la inyección de TranslocoService que ya tenías
  private transloco = inject(TranslocoService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationSrv = inject(NotificationService);

  // --- Propiedades del componente ---
  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;
  languageMenuOpen = false;
  currentLanguageIcon: string = 'assets/img/españa.ico';
  currentLanguage: string = 'Español';
  currentLanguageCode: string = 'es';

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    // Sincronizar el idioma al iniciar el componente y respetar el guardado en localStorage
    if (isPlatformBrowser(this.platformId)) {
      const savedLang = localStorage.getItem('selectedLang');
      const active = this.transloco.getActiveLang();
      if (savedLang && savedLang !== active) {
        this.transloco.setActiveLang(savedLang);
      }
    }

    this.syncWithTransloco();
    this.transloco.langChanges$.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  toggleLanguageMenu() {
    this.languageMenuOpen = !this.languageMenuOpen;
  }

  private syncWithTransloco() {
    const currentLang = this.transloco.getActiveLang();
    this.updateLanguageDisplay(currentLang);
  }

  private updateLanguageDisplay(lang: string) {
    this.currentLanguageCode = lang;
    if (lang === 'es') {
      this.currentLanguageIcon = 'assets/img/españa.ico';
      this.transloco
        .selectTranslate('language.es')
        .pipe(take(1))
        .subscribe((t) => (this.currentLanguage = t));
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.transloco
        .selectTranslate('language.en')
        .pipe(take(1))
        .subscribe((t) => (this.currentLanguage = t));
    }
  }

  selectLanguage(lang: string) {
    this.currentLanguageCode = lang;
    this.transloco.setActiveLang(lang);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedLang', lang);
    }
    this.updateLanguageDisplay(lang);
    this.languageMenuOpen = false;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (success) => {
          if (success) {
            this.transloco
              .selectTranslate('notifications.login.success')
              .pipe(take(1))
              .subscribe((successMessage) => {
                this.notificationSrv.addNotification(successMessage, 'success');
                this.router.navigate(['/admin']);
              });
          }
          this.isLoading = false;
        },
        error: (errorResponse: HttpErrorResponse) => {
          this.isLoading = false;
          const serverErrorMessage = errorResponse?.error?.message;
          const statusCode = errorResponse?.status || 500;
          let notificationMessage: string;

          // Lógica para seleccionar el mensaje traducido según el código de estado
          switch (statusCode) {
            case 400:
              notificationMessage = serverErrorMessage || 'notifications.login.error.badRequest';
              break;
            case 401:
              notificationMessage = serverErrorMessage || 'notifications.login.error.invalidCredentials';
              break;
            case 500:
              notificationMessage = 'notifications.login.error.serverError';
              break;
            case 502:
            case 0: // El status 0 suele indicar un error de conexión
              notificationMessage = 'notifications.login.error.connectionError';
              break;
            default:
              notificationMessage = serverErrorMessage || 'notifications.login.error.unexpected';
              break;
          }

          if (serverErrorMessage) {
            this.notificationSrv.addNotification(serverErrorMessage, 'error');
          } else {
            this.transloco
              .selectTranslate(notificationMessage)
              .pipe(take(1))
              .subscribe((msg) => this.notificationSrv.addNotification(msg, 'error'));
          }
        },
      });
    } else {
      // Usar traducción reactiva para evitar condiciones de carrera
      this.transloco
        .selectTranslate('notifications.login.error.invalidForm')
        .pipe(take(1))
        .subscribe((invalidFormMessage) => this.notificationSrv.addNotification(invalidFormMessage, 'error'));
      this.loginForm.markAllAsTouched();
    }
  }
}