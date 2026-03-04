/**
 * Canon Module — Admin Manifest
 *
 * Declares the admin tools exposed by this module.
 * The admin module loads and mounts these entries dynamically.
 * No admin module is assumed to exist yet — this is ready for future mounting.
 */

export const canonAdminTools = [
  {
    id: 'canon.aisles-viewer',
    label: 'Canon Aisles',
    description: 'Read-only view of all aisles in the canonAisles collection.',
    component: () =>
      import('./ui/CanonViewer').then(m => ({ default: m.AislesViewer })),
  },
  {
    id: 'canon.units-viewer',
    label: 'Canon Units',
    description: 'Read-only view of all units in the canonUnits collection.',
    component: () =>
      import('./ui/CanonViewer').then(m => ({ default: m.UnitsViewer })),
  },
];
