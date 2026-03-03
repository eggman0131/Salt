/**
 * Canon Module – Admin Manifest
 *
 * Declares admin tools exposed by the canon module.
 * The system admin module loads these dynamically – no hard-coded imports
 * needed in admin.
 */

export const adminTools = [
  {
    id: 'canon.aiIngredientParseTool',
    label: 'AI Ingredient Parse Tool',
    component: () =>
      import('./ui/admin/AiIngredientParseTool').then(
        (m) => ({ default: m.AiIngredientParseTool }),
      ),
  },
] as const;
