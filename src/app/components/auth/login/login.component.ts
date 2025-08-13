import { Component, inject } from '@angular/core';
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
import { CommonModule } from '@angular/common';
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
  showPassword: boolean = false;
  isLoading: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder,
    private notificationSrv: NotificationService
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const { email, password } = this.loginForm.value;

      // Llamada al servicio de autenticación
      this.authService.login(email, password).subscribe({
        next: (success) => {
          if (success) {
            this.notificationSrv.addNotification(
              'Autenticación Exitosa."Authentication Successful"',
              'success'
            );
            this.router.navigate(['/admin']);
          }
          this.isLoading = false; // ✅ Restablecer isLoading después del éxito
        },
        error: (errorResponse: HttpErrorResponse) => {
          this.isLoading = false; // ✅ Restablecer isLoading en caso de error
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
