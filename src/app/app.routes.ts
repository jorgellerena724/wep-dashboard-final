import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { LoginGuard } from './core/guards/login.guard';

export const routes: Routes = [
  {
    path: 'admin',
    loadComponent: () =>
      import('./components/dashboard/admin/admin.component').then(
        (m) => m.AdminComponent
      ),
    canActivate: [AuthGuard],
  },

  {
    path: 'users',
    loadComponent: () =>
      import('./components/users/list-users/list-users.component').then(
        (m) => m.UsersComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'header',
    loadComponent: () =>
      import('./components/dashboard/list-header/list-header.component').then(
        (m) => m.ListHeaderComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'carousel',
    loadComponent: () =>
      import(
        './components/dashboard/list-carousel/list-carousel.component'
      ).then((m) => m.ListCarouselComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'news',
    loadComponent: () =>
      import('./components/dashboard/list-news/list-news.component').then(
        (m) => m.ListNewsComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'company',
    loadComponent: () =>
      import('./components/dashboard/list-company/list-company.component').then(
        (m) => m.ListCompanyComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'managers',
    loadComponent: () =>
      import('./components/dashboard/list-manager/list-manager.component').then(
        (m) => m.ListManagerComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./components/dashboard/list-review/list-review.component').then(
        (m) => m.ListReviewComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'categories',
    loadComponent: () =>
      import(
        './components/dashboard/list-category/list-category.component'
      ).then((m) => m.ListCategoryComponent),
    canActivate: [AuthGuard],
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./components/dashboard/list-product/list-product.component').then(
        (m) => m.ListProductComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./components/dashboard/list-contact/list-contact.component').then(
        (m) => m.ListContactComponent
      ),
    canActivate: [AuthGuard],
  },
  {
    path: '',
    canActivate: [LoginGuard],
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      {
        path: 'login',
        loadComponent: () =>
          import('./components/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
        data: { layout: false },
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
