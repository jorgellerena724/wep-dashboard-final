import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class CollapsedService {
  private sidebarCollapsedSubject = new BehaviorSubject<boolean>(false);
  public sidebarCollapsed$: Observable<boolean> = this.sidebarCollapsedSubject.asObservable();
 
  private collapsedWidth = 'w-20';
  private expandedWidth = 'w-64';
 
  // Propiedades para pantallas móviles
  private isMobileSubject = new BehaviorSubject<boolean>(false);
  public isMobile$: Observable<boolean> = this.isMobileSubject.asObservable();
 
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    // Solo ejecutar código relacionado con window si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      // Comprobar el tamaño de la pantalla al iniciar
      this.checkScreenSize();
     
      // Agregar un listener para cambios de tamaño de pantalla
      window.addEventListener('resize', () => this.checkScreenSize());
    }
  }
 
  private checkScreenSize(): void {
    // Solo ejecutar si estamos en el navegador
    if (isPlatformBrowser(this.platformId)) {
      const isMobile = window.innerWidth < 750;
      this.isMobileSubject.next(isMobile);
     
      // Si cambia a móvil, colapsar automáticamente
      if (isMobile && !this.sidebarCollapsedSubject.value) {
        this.sidebarCollapsedSubject.next(true);
      }
    }
  }
 
  toggleSidebar(): void {
    // Solo permitir alternar si no está en modo móvil o forzar colapso en móvil
    if (this.isMobileSubject.value) {
      // En móvil, siempre colapsar
      this.sidebarCollapsedSubject.next(true);
    } else {
      // En escritorio, toggle normal
      this.sidebarCollapsedSubject.next(!this.sidebarCollapsedSubject.value);
    }
  }
 
  getSidebarState(): boolean {
    return this.sidebarCollapsedSubject.value;
  }
 
  setSidebarState(state: boolean): void {
    this.sidebarCollapsedSubject.next(state);
  }
 
  getCollapsedWidth(): string {
    return this.collapsedWidth;
  }
 
  getExpandedWidth(): string {
    return this.expandedWidth;
  }
 
  setMobileState(isMobile: boolean): void {
    this.isMobileSubject.next(isMobile);
    
    // Si cambia a móvil, forzar el colapso del sidebar
    if (isMobile) {
      this.sidebarCollapsedSubject.next(true);
    }
  }
 
  getMobileState(): boolean {
    return this.isMobileSubject.value;
  }
}