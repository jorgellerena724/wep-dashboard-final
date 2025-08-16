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
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [ReactiveFormsModule, CommonModule, TranslocoModule],
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

    // Sincronizar el idioma al iniciar el componente
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
      this.currentLanguage = this.transloco.translate('language.es');
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.currentLanguage = this.transloco.translate('language.en');
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
            // MODIFICADO: Usar la clave de traducción para el mensaje de éxito
            const successMessage = this.transloco.translate('notifications.login.success');
            this.notificationSrv.addNotification(successMessage, 'success');
            this.router.navigate(['/admin']);
          }
          this.isLoading = false;
        },
        error: (errorResponse: HttpErrorResponse) => {
          this.isLoading = false;
          const serverErrorMessage = errorResponse?.error?.message;
          const statusCode = errorResponse?.status || 500;
          let notificationMessage: string;

          // MODIFICADO: Lógica para seleccionar el mensaje traducido según el código de estado
          switch (statusCode) {
            case 400:
              notificationMessage = serverErrorMessage || this.transloco.translate('notifications.login.error.badRequest');
              break;
            case 401:
              notificationMessage = serverErrorMessage || this.transloco.translate('notifications.login.error.invalidCredentials');
              break;
            case 500:
              notificationMessage = this.transloco.translate('notifications.login.error.serverError');
              break;
            case 502:
            case 0: // El status 0 suele indicar un error de conexión
              notificationMessage = this.transloco.translate('notifications.login.error.connectionError');
              break;
            default:
              notificationMessage = serverErrorMessage || this.transloco.translate('notifications.login.error.unexpected');
              break;
          }
          
          this.notificationSrv.addNotification(notificationMessage, 'error');
        },
      });
    } else {
      // MODIFICADO: Usar la clave de traducción para el formulario inválido
      const invalidFormMessage = this.transloco.translate('notifications.login.error.invalidForm');
      this.notificationSrv.addNotification(invalidFormMessage, 'error');
      this.loginForm.markAllAsTouched();
    }
  }
}