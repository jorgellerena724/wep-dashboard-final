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
  isHomeSubmenuOpen = false;
  isAboutSubmenuOpen = false;
  isProductsSubmenuOpen = false;
  isContactSubmenuOpen = false;
  private subscription: Subscription = new Subscription();

  constructor(
    private collapsedService: CollapsedService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.collapsedWidth = this.collapsedService.getCollapsedWidth();
    this.expandedWidth = this.collapsedService.getExpandedWidth();

    // Solo ejecutar checkScreenSize en el navegador
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
  toggleProductsSubmenu(): void {
    this.isProductsSubmenuOpen = !this.isProductsSubmenuOpen;
  }

  isProductsRouteActive(): boolean {
    const currentUrl = this.router.url;
    return (
      currentUrl.includes('/categories') || currentUrl.includes('/products')
    );
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
  // Método para alternar el submenu de contacto
  toggleContactSubmenu(): void {
    if (!this.sidebarCollapsed || this.isMobileView) {
      this.isContactSubmenuOpen = !this.isContactSubmenuOpen;
    }
  }

  // Método para verificar si alguna ruta de contacto está activa
  isContactRouteActive(): boolean {
    const contactRoutes = ['/contact'];
    return contactRoutes.some((route) => this.router.url.includes(route));
  }
  toggleHomeSubmenu(): void {
    this.isHomeSubmenuOpen = !this.isHomeSubmenuOpen;
  }

  toggleAboutSubmenu(): void {
    this.isAboutSubmenuOpen = !this.isAboutSubmenuOpen;
  }

  isHomeRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/carousel') || currentUrl.includes('/news');
  }

  isAboutRouteActive(): boolean {
    const currentUrl = this.router.url;
    return currentUrl.includes('/company') || currentUrl.includes('/managers');
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScreenSize();
    }
  }

  private checkScreenSize(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.isMobileView = window.innerWidth < 768;
      if (this.isMobileView) {
        this.sidebarCollapsed = true;
        this.collapsedService.setSidebarState(true);
        this.showSidebar = false;
        // Cerrar submenu cuando se colapsa en móvil
        this.isHomeSubmenuOpen = false;
        this.isAboutSubmenuOpen = false;
      } else {
        this.showSidebar = true;
      }
    }
  }

  closeMobileSidebar(): void {
    if (this.isMobileView) {
      this.showSidebar = false;
      // Cerrar submenu cuando se cierra el sidebar en móvil
      this.isHomeSubmenuOpen = false;
      this.isAboutSubmenuOpen = false;
    }
  }

  private updateRouteTitle(): void {
    const routePath = this.router.url;
    switch (true) {
      case routePath.includes('/admin'):
        this.currentRouteTitle = 'Administración';
        break;
      case routePath.includes('/carousel'):
        this.currentRouteTitle = 'Inicio - Carrusel';
        break;
      case routePath.includes('/news'):
        this.currentRouteTitle = 'Inicio - Novedades';
        break;
      case routePath.includes('/home'):
        this.currentRouteTitle = 'Inicio';
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

    // Auto-abrir el submenu de Inicio si estamos en una de sus rutas
    if (routePath.includes('carousel') || routePath.includes('/news')) {
      this.isHomeSubmenuOpen = true;
    }

    // Auto-abrir el submenu de Quiénes Somos si estamos en una de sus rutas
    if (
      routePath.includes('/company') ||
      routePath.includes('/managers') ||
      routePath.includes('/reviews')
    ) {
      this.isAboutSubmenuOpen = true; // Añadido
    }
    // Auto-abrir el submenu de Productos si estamos en una de sus rutas
    if (routePath.includes('/categories') || routePath.includes('/products')) {
      this.isProductsSubmenuOpen = true;
    }
  }
}
