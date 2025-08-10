import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  RouterLink,
  RouterLinkActive,
  Router,
  NavigationEnd,
} from '@angular/router';
import { CollapsedService } from '../../../shared/services/system/collapsed.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    RouterLinkActive,
    TranslocoModule,
  ],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  sidebarCollapsed = false;
  collapsedWidth: string;
  expandedWidth: string;
  isMobileView = false;
  showSidebar = true;
  currentRouteTitle = '';

  // Estados de los submenús
  isHeaderSubmenuOpen = false;
  isHomeSubmenuOpen = false;
  isAboutSubmenuOpen = false;
  isProductsSubmenuOpen = false;
  isContactSubmenuOpen = false;
  isUsersSubmenuOpen = false;

  private subscription: Subscription = new Subscription();

  constructor(
    private collapsedService: CollapsedService,
    public router: Router, 
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.collapsedWidth = this.collapsedService.getCollapsedWidth();
    this.expandedWidth = this.collapsedService.getExpandedWidth();

    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  ngOnInit(): void {
    this.subscription.add(
      this.collapsedService.sidebarCollapsed$.subscribe((collapsed) => {
        this.sidebarCollapsed = collapsed;
      })
    );

    this.subscription.add(
      this.collapsedService.isMobile$.subscribe((isMobile) => {
        this.isMobileView = isMobile;
        if (isMobile) {
          this.showSidebar = false;
        } else {
          this.showSidebar = true;
        }
      })
    );

    this.subscription.add(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          this.updateRouteTitle();
        })
    );

    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
      this.updateRouteTitle();
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  toggleSidebar(): void {
    if (this.isMobileView) {
      this.showSidebar = !this.showSidebar;
    } else {
      this.collapsedService.toggleSidebar();
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  // --- Métodos para Submenús ---

  toggleHeaderSubmenu(): void {
    this.isHeaderSubmenuOpen = !this.isHeaderSubmenuOpen;
  }

  isHeaderRouteActive(): boolean {
    return this.router.url.includes('/header');
  }

  toggleHomeSubmenu(): void {
    this.isHomeSubmenuOpen = !this.isHomeSubmenuOpen;
  }

  isHomeRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/carousel') || currentUrl.includes('/news');
  }

  toggleAboutSubmenu(): void {
    this.isAboutSubmenuOpen = !this.isAboutSubmenuOpen;
  }

  isAboutRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/company') ||
      currentUrl.includes('/managers') ||
      currentUrl.includes('/reviews')
    );
  }

  toggleProductsSubmenu(): void {
    this.isProductsSubmenuOpen = !this.isProductsSubmenuOpen;
  }

  isProductsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/categories') || currentUrl.includes('/products')
    );
  }

toggleContactSubmenu(): void {
  this.isContactSubmenuOpen = !this.isContactSubmenuOpen;
}
  isContactRouteActive(): boolean {
    return this.router.url.includes('/contact');
  }

  toggleUsersSubmenu(): void {
    this.isUsersSubmenuOpen = !this.isUsersSubmenuOpen;
  }

  isUsersRouteActive(): boolean {
    return this.router.url.includes('/users');
  }

  private checkScreenSize(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobileView = window.innerWidth < 768;
      if (this.isMobileView) {
        this.sidebarCollapsed = true;
        this.collapsedService.setSidebarState(true);
        this.showSidebar = false;
        this.isHeaderSubmenuOpen = false;
        this.isHomeSubmenuOpen = false;
        this.isAboutSubmenuOpen = false;
        this.isProductsSubmenuOpen = false;
        this.isContactSubmenuOpen = false;
        this.isUsersSubmenuOpen = false;
      } else {
        this.showSidebar = true;
      }
    }
  }

  closeMobileSidebar(): void {
    if (this.isMobileView) {
      this.showSidebar = false;
    }
  }

  private updateRouteTitle(): void {
    const routePath = this.router.url;
    this.isHeaderSubmenuOpen = routePath.includes('/header');
    this.isHomeSubmenuOpen =
      routePath.includes('/carousel') || routePath.includes('/news');
    this.isAboutSubmenuOpen =
      routePath.includes('/company') ||
      routePath.includes('/managers') ||
      routePath.includes('/reviews');
    this.isProductsSubmenuOpen =
      routePath.includes('/categories') || routePath.includes('/products');
    this.isContactSubmenuOpen = routePath.includes('/contact');
    this.isUsersSubmenuOpen = routePath.includes('/users');
    switch (true) {
      case routePath.includes('/admin'):
        this.currentRouteTitle = 'Administración';
        break;
      case routePath.includes('/header'):
        this.currentRouteTitle = 'Encabezado';
        break;
      case routePath.includes('/carousel'):
        this.currentRouteTitle = 'Inicio - Carrusel';
        break;
      case routePath.includes('/news'):
        this.currentRouteTitle = 'Inicio - Novedades';
        break;
      case routePath.includes('/users'):
        this.currentRouteTitle = 'Usuarios';
        break;
      case routePath.includes('/categories'):
        this.currentRouteTitle = 'Categorías';
        break;
      case routePath.includes('/products'):
        this.currentRouteTitle = 'Ofertas';
        break;
      default:
        this.currentRouteTitle = '';
        break;
    }
  }
}