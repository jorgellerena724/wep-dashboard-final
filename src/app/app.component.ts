import {
  Component,
  HostListener,
  Inject,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
} from '@angular/core';
import {
  Router,
  NavigationEnd,
  RouterOutlet,
  ActivatedRoute,
} from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { filter, map, mergeMap, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { ModalComponent } from './shared/components/app-modal/app-modal.component';
import { NotificationComponent } from './shared/components/app-notification/app-notification.component';
import { ModalService } from './shared/services/system/modal.service';
import { SidebarComponent } from '../app/components/layout/sidebar/sidebar.component';
import { FooterComponent } from '../app/components/layout/footer/footer.component';
import { CollapsedService } from '../app/shared/services/system/collapsed.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    CommonModule,
    ModalComponent,
    NotificationComponent,
    SidebarComponent,
    FooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'wici-front';
  showLayout = true;
  isCollapsed = false;
  isMobile = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private modalService: ModalService,
    private collapsedService: CollapsedService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Verificar si la ruta actual es la página de login
        if (event.url.includes('/login')) {
          // Cerrar el modal globalmente
          this.modalService.close();
        }
      }
    });
  }

  ngOnInit(): void {
    this.checkScreenSize();

    // Suscribirse al estado del sidebar para actualizar isCollapsed
    this.collapsedService.sidebarCollapsed$
      .pipe(takeUntil(this.destroy$))
      .subscribe((collapsed) => {
        this.isCollapsed = collapsed;
      });

    // Suscribirse al estado móvil
    this.collapsedService.isMobile$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isMobile) => {
        this.isMobile = isMobile;
        // Si cambia a móvil, asegurarse que el layout se ajusta correctamente
        if (isMobile && this.showLayout) {
          // Forzar el colapso del sidebar en móvil
          this.collapsedService.setSidebarState(true);
        }
      });

    // Detectar cambios en la ruta activa
    this.router.events
      .pipe(
        takeUntil(this.destroy$),
        filter((event) => event instanceof NavigationEnd),
        map(() => {
          let route = this.activatedRoute;
          while (route.firstChild) {
            route = route.firstChild;
          }
          return route;
        }),
        mergeMap((route) => route.data)
      )
      .subscribe((data) => {
        this.showLayout = data['layout'] !== false;
      });
  }

  ngOnDestroy(): void {
    // Limpiar todas las suscripciones cuando el componente se destruye
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    if (isPlatformBrowser(this.platformId)) {
      const newIsMobile = window.innerWidth <= 768;

      // Actualizar el estado móvil solo si ha cambiado
      if (this.isMobile !== newIsMobile) {
        this.isMobile = newIsMobile;
        this.collapsedService.setMobileState(this.isMobile);

        // En móvil, asegurarse de que el sidebar esté colapsado
        if (this.isMobile) {
          this.collapsedService.setSidebarState(true);
        }
      }
    }
  }
}
