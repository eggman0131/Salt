/**
 * Shopping Module Public API
 * 
 * This is the only file that should be imported by code outside the shopping module.
 * Internal components and utilities are private to the module.
 */

export { shoppingBackend } from './backend';
export type { IShoppingBackend } from './backend';
export { ShoppingListModule } from './components/ShoppingListModule';
export type { ShoppingList, ShoppingListItem } from '../../types/contract';
