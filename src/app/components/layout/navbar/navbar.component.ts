import {
  Component,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Inject,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import {
  RouterModule,
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
import { ChangeUserPasswordComponent } from '../../users/change-user-password/change-user-password.component';
import { BackupService } from '../../../shared/services/system/backup.service';
import { NotificationService } from '../../../shared/services/system/notification.service';
import { ConfirmDialogComponent } from '../../../shared/components/app-confirm-dialog/app-confirm-dialog.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
    ConfirmDialogComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnChanges {
  @Input() sessionClient?: string;
  @ViewChild('confirmDialog') confirmDialog!: ConfirmDialogComponent;

  private transloco = inject(TranslocoService);

  mobileMenuOpen = false;
  isHomeSubmenuOpen = false;
  isAboutSubmenuOpen = false;
  isProductsSubmenuOpen = false;
  isPublicationsSubmenuOpen = false;
  isContactSubmenuOpen = false;
  isHeaderSubmenuOpen = false;
  isUsersSubmenuOpen = false;

  languageMenuOpen = false;
  userMenuOpen = false;
  currentRoute = '';
  currentSubRoute = '';
  currentLanguageIcon: string = 'assets/img/españa.ico';
  currentLanguage: string = 'Español';
  currentLanguageCode: string = 'es';
  userData: any = null;
  showUsersMenu = true;
  showBackupButtons = false;

  constructor(
    private router: Router,
    private authSrv: AuthService,
    private modalSrv: ModalService,
    private backupService: BackupService,
    private notificationService: NotificationService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.mobileMenuOpen = false;
      });

    this.syncWithTransloco();
    this.loadUserData();
    this.transloco.langChanges$.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });
    if (isPlatformBrowser(this.platformId)) {
      this.initShowUsersMenu();
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initShowUsersMenu();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionClient'] && !changes['sessionClient'].isFirstChange()) {
      this.initShowUsersMenu();
    }
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  saveInformation(): void {
    this.userMenuOpen = false;

    // Crear notificación con barra de progreso
    const notificationId = this.notificationService.addNotification(
      this.transloco.translate('navbar.backup.generating'),
      'info',
      true
    );

    // Simular progreso durante la generación del backup
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 15; // Incremento aleatorio para simular progreso
      if (progress < 90) {
        this.notificationService.updateProgress(notificationId, progress);
      }
    }, 200);

    this.backupService.downloadBackup().subscribe({
      next: (blob: Blob) => {
        // Completar el progreso
        clearInterval(progressInterval);
        this.notificationService.updateProgress(notificationId, 100);

        // Crear URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        // Generar nombre de archivo con fecha
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        link.download = `backup_${dateStr}.zip`;

        // Descargar el archivo
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Limpiar URL temporal
        window.URL.revokeObjectURL(url);

        // Mostrar notificación de éxito después de un breve delay
        setTimeout(() => {
          this.notificationService.addNotification(
            this.transloco.translate('navbar.backup.download_success'),
            'success'
          );
        }, 1000);
      },
      error: (error) => {
        // Detener progreso y remover notificación en caso de error
        clearInterval(progressInterval);
        this.notificationService.removeNotificationById(notificationId);

        console.error('Error al descargar backup:', error);
        const errorMessage =
          error?.error?.detail ||
          error?.message ||
          this.transloco.translate('navbar.backup.download_error');
        const translatedMessage = this.transloco.translate(
          'navbar.backup.download_error_message',
          { message: errorMessage }
        );
        this.notificationService.addNotification(translatedMessage, 'error');
      },
    });
  }

  async restoreInformation(): Promise<void> {
    this.userMenuOpen = false;

    // Crear input file dinámicamente
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip';

    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (!file) {
        return;
      }

      // Verificar que es un archivo ZIP
      if (!file.name.endsWith('.zip')) {
        this.notificationService.addNotification(
          this.transloco.translate('navbar.backup.invalid_file'),
          'error'
        );
        return;
      }

      // Configurar el diálogo de confirmación
      this.confirmDialog.title = this.transloco.translate(
        'navbar.confirm_restore_title'
      );
      this.confirmDialog.message = this.transloco.translate(
        'navbar.confirm_restore'
      );
      this.confirmDialog.confirmLabel = this.transloco.translate(
        'navbar.confirm_restore_button'
      );
      this.confirmDialog.cancelLabel = this.transloco.translate(
        'navbar.cancel_button'
      );

      // Mostrar el diálogo de confirmación
      const confirmed = await this.confirmDialog.show();

      if (!confirmed) {
        return;
      }

      this.notificationService.addNotification(
        this.transloco.translate('navbar.backup.restoring'),
        'info'
      );

      this.backupService.restoreBackup(file).subscribe({
        next: (response) => {
          this.notificationService.addNotification(
            this.transloco.translate('navbar.backup.restore_success'),
            'success'
          );

          // Recargar la página después de 2 segundos
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        },
        error: (error) => {
          console.error('Error al restaurar backup:', error);
          const errorMessage =
            error?.error?.detail ||
            error?.message ||
            this.transloco.translate('navbar.backup.restore_error');
          const translatedMessage = this.transloco.translate(
            'navbar.backup.restore_error_message',
            { message: errorMessage }
          );
          this.notificationService.addNotification(translatedMessage, 'error');
        },
      });
    };

    input.click();
  }

  changePassword(): void {
    this.userMenuOpen = false;
    const changePasswordTitle = this.transloco.translate('navbar.changepass');

    const modalConfig: ModalConfig = {
      title: changePasswordTitle,
      component: ChangeUserPasswordComponent,
      data: {
        initialData: {
          id: this.userData?.id,
          email: this.userData?.email,
        },
      },
    };
    this.modalSrv.open(modalConfig);
  }

  toggleHomeSubmenu() {
    this.isHomeSubmenuOpen = !this.isHomeSubmenuOpen;
  }

  toggleAboutSubmenu(): void {
    this.isAboutSubmenuOpen = !this.isAboutSubmenuOpen;
  }

  toggleProductsSubmenu(): void {
    this.isProductsSubmenuOpen = !this.isProductsSubmenuOpen;
  }

  togglePublicationsSubmenu(): void {
    this.isPublicationsSubmenuOpen = !this.isPublicationsSubmenuOpen;
  }

  toggleContactSubmenu(): void {
    this.isContactSubmenuOpen = !this.isContactSubmenuOpen;
  }

  toggleHeaderSubmenu(): void {
    this.isHeaderSubmenuOpen = !this.isHeaderSubmenuOpen;
  }

  toggleUsersSubmenu(): void {
    this.isUsersSubmenuOpen = !this.isUsersSubmenuOpen;
  }

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  private closeOtherSubmenus(except: string | null) {
    if (except !== 'home') this.isHomeSubmenuOpen = false;
    if (except !== 'about') this.isAboutSubmenuOpen = false;
    if (except !== 'products') this.isProductsSubmenuOpen = false;
    if (except !== 'publications') this.isPublicationsSubmenuOpen = false;
    if (except !== 'contact') this.isContactSubmenuOpen = false;
    if (except !== 'header') this.isHeaderSubmenuOpen = false;
    if (except !== 'users') this.isUsersSubmenuOpen = false;
  }

  onNavItemClick(parent: string | null) {
    if (parent) {
      this.closeOtherSubmenus(parent);
    } else {
      this.closeOtherSubmenus(null);
    }
    this.mobileMenuOpen = false;
  }

  private loadUserData(): void {
    try {
      const possibleKeys = [
        'userData',
        'user',
        'authUser',
        'currentUser',
        'token',
        'authToken',
      ];
      let rawData: string | null = null;
      for (const key of possibleKeys) {
        const data = isPlatformBrowser(this.platformId)
          ? localStorage.getItem(key)
          : null;
        if (data) {
          rawData = data;
          break;
        }
      }
      if (!rawData && isPlatformBrowser(this.platformId)) {
        const extras = [
          'session',
          'userSession',
          'wep_session',
          'sessionClient',
        ];
        for (const k of extras) {
          const d = localStorage.getItem(k);
          if (d) {
            rawData = d;
            break;
          }
        }
      }

      if (rawData) {
        try {
          const parsed = JSON.parse(rawData);
          if (parsed && typeof parsed === 'object') {
            if ('user' in parsed && parsed.user) {
              this.userData = parsed.user;
            } else {
              this.userData = parsed;
            }
          } else {
            this.userData = parsed;
          }
        } catch (e) {
          this.userData = rawData;
        }
      } else {
        this.userData = null;
      }
      if (this.userData && typeof this.userData === 'object') {
        if (!('client' in this.userData)) {
          const clientFromStorage = this.getClientFromLocalStorage();
          if (clientFromStorage) {
            try {
              this.userData.client = clientFromStorage;
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      this.userData = null;
    }
  }

  getUserClient(): string {
    if (!this.userData) {
      const clientStorage = this.getClientFromLocalStorage();
      return clientStorage ?? '—';
    }
    if (typeof this.userData === 'string') {
      const clientStorage = this.getClientFromLocalStorage();
      return clientStorage ?? this.userData ?? '—';
    }

    if (this.userData.client) return String(this.userData.client);
    if (this.userData.session && this.userData.session.client)
      return String(this.userData.session.client);
    if (this.userData.user && this.userData.user.client)
      return String(this.userData.user.client);
    if (this.userData.client_name) return String(this.userData.client_name);
    const clientFromStorage = this.getClientFromLocalStorage();
    return clientFromStorage ?? '—';
  }

  isHomeRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/carousel') || currentUrl.includes('/news');
  }

  isAboutRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/company') ||
      currentUrl.includes('/manager-category') ||
      currentUrl.includes('/managers') ||
      currentUrl.includes('/reviews')
    );
  }

  isProductsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/categories') || currentUrl.includes('/products')
    );
  }

  isPublicationsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/publication-category') ||
      currentUrl.includes('/publications')
    );
  }

  isContactRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/contact');
  }

  isHeaderRouteActive(): boolean {
    return this.router.url.includes('/header');
  }

  isUsersRouteActive(): boolean {
    return this.router.url.includes('/users');
  }

  logout() {
    this.authSrv.logout();
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
      this.currentLanguage = 'Español';
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.currentLanguage = 'English';
    }
  }

  selectLanguage(lang: string) {
    this.currentLanguageCode = lang;
    this.transloco.setActiveLang(lang);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('selectedLang', lang);
    }
    if (lang === 'es') {
      this.currentLanguageIcon = 'assets/img/españa.ico';
      this.currentLanguage = 'Español';
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.currentLanguage = 'English';
    }
    this.languageMenuOpen = false;
  }

  private initShowUsersMenu(): void {
    const clientFromInput = this.sessionClient;
    if (clientFromInput !== undefined && clientFromInput !== null) {
      this.showUsersMenu = this.isClientAllowed(clientFromInput);
      this.showBackupButtons = this.isClientAllowed(clientFromInput);
      return;
    }

    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showUsersMenu = this.isClientAllowed(clientFromStorage);
      this.showBackupButtons = this.isClientAllowed(clientFromStorage);
      return;
    }
    this.showUsersMenu = true;
    this.showBackupButtons = false;
  }

  private isClientAllowed(clientValue: string | undefined | null): boolean {
    if (!clientValue && clientValue !== '') {
      return true;
    }
    return clientValue === 'shirkasoft';
  }

  private getClientFromLocalStorage(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const candidateKeys = [
      'session',
      'user',
      'userSession',
      'auth',
      'currentUser',
      'wep_session',
      'sessionClient',
      'client',
    ];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if ('client' in parsed && parsed.client) return parsed.client;
          if ('session' in parsed && parsed.session && parsed.session.client)
            return parsed.session.client;
          if ('user' in parsed && parsed.user && parsed.user.client)
            return parsed.user.client;
        }
        if (typeof parsed === 'string' && parsed.trim().length > 0) {
          return parsed;
        }
      } catch (e) {
        if (raw && raw.trim().length > 0) return raw;
      }
    }
    return null;
  }
}
