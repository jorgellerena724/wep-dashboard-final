import {
  Component,
  inject,
  OnInit,
  OnChanges,
  SimpleChanges,
  Input,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { RouterModule, Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ModalService, ModalConfig } from '../../../shared/services/system/modal.service';
import { ChangeUserPasswordComponent } from '../../users/change-user-password/change-user-password.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterModule,
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslocoModule,
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit, OnChanges {
  @Input() sessionClient?: string;

  private transloco = inject(TranslocoService);

  mobileMenuOpen = false;
  isHomeSubmenuOpen = false;
  isAboutSubmenuOpen = false;
  isProductsSubmenuOpen = false;
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

  constructor(
    private router: Router,
    private authSrv: AuthService,
    private modalSrv: ModalService,
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
      let userData: string | null = null;
      for (const key of possibleKeys) {
        const data = isPlatformBrowser(this.platformId) ? localStorage.getItem(key) : null;
        if (data) {
          userData = data;
          break;
        }
      }

      if (userData) {
        this.userData = JSON.parse(userData);
      } else {
        this.userData = null;
      }
    } catch (error) {
      this.userData = null;
    }
  }

  getUserInitials(): string {
    if (this.userData && this.userData.full_name) {
      const initials = this.userData.full_name
        .split(' ')
        .map((word: string) => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
      return initials;
    }
    return 'U';
  }

  isHomeRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/carousel') || currentUrl.includes('/news');
  }

  isAboutRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/company') ||
      currentUrl.includes('/managers') ||
      currentUrl.includes('/reviews')
    );
  }

  isProductsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/categories') || currentUrl.includes('/products');
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
      return;
    }

    const clientFromStorage = this.getClientFromLocalStorage();
    if (clientFromStorage !== null) {
      this.showUsersMenu = this.isClientAllowed(clientFromStorage);
      return;
    }
    this.showUsersMenu = true;
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
    ];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'client' in parsed) {
          return parsed['client'];
        }
        if (typeof parsed === 'string') {
          return parsed;
        }
      } catch (e) {
        if (typeof raw === 'string' && raw.trim().length > 0) {
          return raw;
        }
      }
    }
    const direct = localStorage.getItem('sessionClient');
    if (direct) return direct;
    return null;
  }
}
