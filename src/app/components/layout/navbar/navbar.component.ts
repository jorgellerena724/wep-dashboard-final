import { Component, inject } from '@angular/core';
import {
  RouterModule,
  Router,
  NavigationEnd,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ModalService,
  ModalConfig,
} from '../../../shared/services/system/modal.service';
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
export class NavbarComponent {
  private transloco = inject(TranslocoService);

  mobileMenuOpen = false;
  isHomeSubmenuOpen = false;
  isAboutSubmenuOpen = false;
  isProductsSubmenuOpen = false;
  isContactSubmenuOpen = false;
  languageMenuOpen = false;
  userMenuOpen = false;
  currentRoute = '';
  currentSubRoute = '';
  currentLanguageIcon: string = 'assets/img/españa.ico';
  currentLanguage: string = 'Español';
  currentLanguageCode: string = 'es';
  userData: any = null;

  constructor(private router: Router, private authSrv: AuthService, private modalSrv: ModalService) {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        const url = event.urlAfterRedirects || this.router.url;
        const segments = url.split('/');
        this.mobileMenuOpen = false;
      });

    this.syncWithTransloco();
    this.loadUserData();
    this.transloco.langChanges$.subscribe((lang) => {
      this.updateLanguageDisplay(lang);
    });
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

  toggleUserMenu(): void {
    this.userMenuOpen = !this.userMenuOpen;
  }

  private loadUserData(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
        }
      }
      const possibleKeys = [
        'userData',
        'user',
        'authUser',
        'currentUser',
        'token',
        'authToken',
      ];
      let userData = null;
      let foundKey = '';
      for (const key of possibleKeys) {
        const data = localStorage.getItem(key);
        if (data) {
          userData = data;
          foundKey = key;
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
    return currentUrl.includes('/company') || currentUrl.includes('/managers');
  }

  isProductsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/categories') || currentUrl.includes('/products')
    );
  }

  isContactRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/contact');
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
    localStorage.setItem('selectedLang', lang);
    if (lang === 'es') {
      this.currentLanguageIcon = 'assets/img/españa.ico';
      this.currentLanguage = 'Español';
    } else if (lang === 'en') {
      this.currentLanguageIcon = 'assets/img/eeuu.ico';
      this.currentLanguage = 'English';
    }
    this.languageMenuOpen = false;
  }
}