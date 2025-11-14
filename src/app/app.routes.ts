import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const appRoutes: Routes = [
  {
    path: 'auth',
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout.component').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'chat',
        loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'chat/:id',
        loadComponent: () => import('./chat/chat.component').then(m => m.ChatComponent)
      },
      {
        path: 'library',
        loadComponent: () => import('./library/library.component').then(m => m.LibraryComponent)
      },
      {
        path: 'projects',
        loadComponent: () => import('./project-panel/projects.component').then(m => m.ProjectsComponent)
      },
      {
        path: 'keys',
        loadComponent: () => import('./components/openai-key-manager/openai-key-manager.component').then(m => m.OpenaiKeyManagerComponent)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'chat'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'chat'
  }
];
