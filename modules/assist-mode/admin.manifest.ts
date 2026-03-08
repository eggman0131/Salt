/**
 * Assist Mode Module — Admin Manifest
 */

export const assistModeAdminTools = [
  {
    id: 'assist-mode.guides',
    label: 'Cook Guides',
    description: 'View and delete generated Assist Mode cook guides',
    component: () => import('./ui/GuidesAdmin').then(m => ({ default: m.GuidesAdmin })),
  },
];
