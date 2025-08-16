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
import { CommonModule, isPlatformBrowser } from '@angular/common'; // ---> AÑADIDO: isPlatformBrowser
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  imports: [ReactiveFormsModule, CommonModule, TranslocoModule],
  standalone: true,
})
export class LoginComponent {
  private transloco = inject(TranslocoService);
  loginForm: FormGroup;
  showPassword = false;
  isLoading = false;

  // ---> AÑADIDO: Variables de estado para el selector de idioma <---
  languageMenuOpen = false;
  currentLanguageIcon: string = 'assets/img/españa.ico';
  currentLanguage: string = 'Español';
  currentLanguageCode: string = 'es';

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private notificationSrv: NotificationService,
    // ---> AÑADIDO: Inyección para detectar la plataforma (navegador o servidor) <---
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    // ---> AÑADIDO: Lógica para sincronizar el idioma al iniciar el componente <---
    this.syncWithTransloco();
    this.transloco.langChanges$.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  // ---> AÑADIDO: Métodos para manejar el selector de idioma <---

  /**
   * Abre o cierra el menú desplegable de idiomas.
   */
  toggleLanguageMenu() {
    this.languageMenuOpen = !this.languageMenuOpen;
  }

  /**
   * Sincroniza el estado visual del selector con el idioma activo en Transloco.
   */
  private syncWithTransloco() {
    const currentLang = this.transloco.getActiveLang();
    this.updateLanguageDisplay(currentLang);
  }

  /**
   * Actualiza el icono y el texto del idioma actual basado en el código de idioma.
   * @param lang - El código de idioma ('es', 'en', etc.).
   */
  private updateLanguageDisplay(lang: string) {
    this.currentLanguageCode = lang;
    if (lang === 'es') {
      this.currentLanguageIcon = 'assets/img/españa.ico';
      this.currentLanguage = 'Español';
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.currentLanguage = 'English';
    }
  }

  /**
   * Cambia el idioma activo en la aplicación y lo guarda en el almacenamiento local.
   * @param lang - El nuevo código de idioma a activar.
   */
  selectLanguage(lang: string) {
    this.currentLanguageCode = lang;
    this.transloco.setActiveLang(lang);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedLang', lang);
    }
    this.updateLanguageDisplay(lang);
    this.languageMenuOpen = false; // Cierra el menú después de seleccionar
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;

      this.authService.login(email, password).subscribe({
        next: (success) => {
          if (success) {
            this.notificationSrv.addNotification(
              'Autenticación Exitosa."Authentication Successful"',
              'success'
            );
            this.router.navigate(['/admin']);
          }
          this.isLoading = false;
        },
        error: (errorResponse: HttpErrorResponse) => {
          this.isLoading = false;
          const errorMessage =
            errorResponse?.error?.message ||
            'Ha ocurrido un error inesperado. Inténtelo nuevamente más tarde."An unexpected error has occurred. Please try again later."';
          const statusCode = errorResponse?.status || 500;

          if (statusCode === 400) {
            this.notificationSrv.addNotification(
              errorMessage ||
                'Solicitud incorrecta. Verifica los datos enviados."Bad request. Check the submitted data."',
              'error'
            );
          } else if (statusCode === 401) {
            this.notificationSrv.addNotification(
              errorMessage ||
                'Credenciales inválidas. Por favor, verifica tu correo y contraseña."Invalid credentials. Please check your email and password."',
              'error'
            );
          } else if (statusCode === 500) {
            this.notificationSrv.addNotification(
              'Error interno del servidor. Inténtelo nuevamente más tarde."Internal server error. Please try again later."',
              'error'
            );
          } else if (statusCode === 502) {
            this.notificationSrv.addNotification(
              'No se pudo conectar con el servidor. Verifique su conexión e inténtelo más tarde."Could not connect to the server. Please check your connection and try again later."',
              'error'
            );
          } else if (statusCode === 0) {
            this.notificationSrv.addNotification(
              'No se pudo conectar con el servidor. Verifique su conexión e inténtelo más tarde."Could not connect to the server. Please check your connection and try again later."',
              'error'
            );
          } else {
            this.notificationSrv.addNotification(
              errorMessage ||
                'Ha ocurrido un error inesperado. Inténtelo nuevamente más tarde."An unexpected error has occurred. Please try again later."',
              'error'
            );
          }
        },
      });
    } else {
      this.notificationSrv.addNotification('Formulario no válido."Invalid form"', 'error');
      this.loginForm.markAllAsTouched();
    }
  }
}