# Salt Testing Guide

## Testing Architecture

Salt uses **Vitest** for unit and integration testing. Tests are organized within each module for better maintainability and locality.

## Structure

```
modules/
  shopping/
    __tests__/
      backend.spec.ts          ← Backend logic tests
      integration.spec.ts      ← Module integration tests
  recipes/
    __tests__/
      backend.spec.ts
      integration.spec.ts
  ...etc
```

## Running Tests

```bash
# Watch mode (interactive)—
npm run test

# UI dashboard
npm run test:ui

# Single run (CI/CD)
npm run test:run

# Coverage report
npm run test:coverage
```

## Writing Module Tests

### Backend Tests (`backend.spec.ts`)

Test the backend interface implementations (base and Firebase).

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BaseShoppingBackend } from '../base-shopping-backend';
import type { ShoppingBackendInterface } from '../shopping-backend.interface';

describe('Shopping Backend', () => {
  let backend: ShoppingBackendInterface;

  beforeEach(() => {
    backend = new BaseShoppingBackend();
  });

  it('should create a shopping list', async () => {
    const list = await backend.createList('Test List', {});
    expect(list).toHaveProperty('id');
    expect(list.name).toBe('Test List');
  });

  it('should add items to a list', async () => {
    const list = await backend.createList('Test List', {});
    const item = await backend.addItem(list.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });
    expect(item).toHaveProperty('id');
  });
});
```

### Integration Tests (`integration.spec.ts`)

Test how backend and components work together.

```typescript
import { describe, it, expect } from 'vitest';
import { BaseShoppingBackend } from '../base-shopping-backend';

describe('Shopping Module Integration', () => {
  it('should handle complete shopping workflow', async () => {
    const backend = new BaseShoppingBackend();
    
    // Create list
    const list = await backend.createList('Weekly Shop', {});
    
    // Add items
    await backend.addItem(list.id, {
      canonicalItemId: 'item-1',
      quantity: 500,
      unit: 'g',
    });
    
    // Retrieve list
    const retrieved = await backend.getList(list.id);
    expect(retrieved.items).toHaveLength(1);
  });
});
```

## Testing Patterns

### Mocking Backend

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Module with mocked backend', () => {
  it('should call backend method', async () => {
    const mockBackend = {
      createList: vi.fn().mockResolvedValue({ id: 'list-1', name: 'Test' }),
    };
    
    const result = await mockBackend.createList('Test', {});
    expect(mockBackend.createList).toHaveBeenCalledWith('Test', {});
    expect(result.id).toBe('list-1');
  });
});
```

### Testing Zod Validation

```typescript
import { describe, it, expect } from 'vitest';
import { ShoppingListSchema } from '../../../types/contract';

describe('Shopping List Validation', () => {
  it('should validate correct shopping list', () => {
    const valid = {
      id: 'list-1',
      userId: 'user-1',
      name: 'Test List',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const result = ShoppingListSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('should reject invalid shopping list', () => {
    const invalid = { id: 'list-1' }; // Missing required fields
    const result = ShoppingListSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

## Best Practices

1. **Test the interface, not the implementation** - Both base and Firebase implementations should satisfy the same tests
2. **Keep tests close to code** - `__tests__` in each module
3. **Test behaviour, not implementation details** - Focus on "what" not "how"
4. **Use fixtures sparingly** - Prefer builders or factory functions
5. **Test error cases** - Invalid input, network failures, etc.
6. **Avoid setTimeout** - Use proper async patterns or mocking

## Common Test Utilities

See `modules/README.md` for framework/helper imports available to all modules.

## Continuous Integration

Tests run automatically on:
- Pull requests
- Commits to main
- Pre-deployment

Coverage target: **80%+ for backend logic**
