/**
 * Admin Module — Admin Manifest
 *
 * Exposes system-level admin tools (users, settings, etc.).
 */

export const adminAdminTools = [
  {
    id: 'admin.users',
    label: 'Authorised Users',
    description: 'Add, edit, remove users and drag to set display order',
    component: () => import('./ui/UsersAdmin').then(m => ({ default: m.UsersAdmin })),
  },
  {
    id: 'admin.system-settings',
    label: 'System Settings',
    description: 'Global AI rules (kitchen directives) and debug mode',
    component: () => import('./ui/SystemSettingsAdmin').then(m => ({ default: m.SystemSettingsAdmin })),
  },
];
