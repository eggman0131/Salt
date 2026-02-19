/**
 * Admin Module - Frontend Contract Tests
 *
 * Test suite for AdminModule React component focusing on:
 * - Contract compliance (Zod schema validation)
 * - Type safety (TypeScript type checking)
 * - Data consistency (linked references)
 * - Edge cases and boundaries
 */

import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  User,
  KitchenSettings,
} from '../../../../types/contract';
import {
  UserSchema,
  KitchenSettingsSchema,
} from '../../../../types/contract';

// ============================================================================
// SECTION 1: Test Fixtures (Contract-Shaped Data)
// ============================================================================

const USERS_FIXTURE: User[] = [
  {
    id: 'user-1',
    email: 'chef@example.com',
    displayName: 'Head Chef',
  },
  {
    id: 'user-2',
    email: 'sous@example.com',
    displayName: 'Sous Chef',
  },
  {
    id: 'user-3',
    email: 'assistant@example.com',
    displayName: 'Kitchen Assistant',
  },
];

const KITCHEN_SETTINGS_FIXTURE: KitchenSettings = {
  directives: 'Using British English and metric units exclusively. Focus on high-end domestic cooking techniques.',
  userOrder: ['user-1', 'user-2', 'user-3'],
  debugEnabled: false,
};

// ============================================================================
// SECTION 2: Contract Compliance Tests
// ============================================================================

describe('AdminModule - Contract Compliance', () => {
  describe('User Schema', () => {
    it('should validate all fixture users conform to schema', () => {
      USERS_FIXTURE.forEach(user => {
        expect(() => UserSchema.parse(user)).not.toThrow();
      });
    });

    it('should have all required fields', () => {
      const user = USERS_FIXTURE[0];
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.displayName).toBeDefined();
    });

    it('should reject user without id', () => {
      const invalid = { ...USERS_FIXTURE[0], id: undefined };
      expect(() => UserSchema.parse(invalid)).toThrow();
    });

    it('should reject user without email', () => {
      const invalid = { ...USERS_FIXTURE[0], email: undefined };
      expect(() => UserSchema.parse(invalid)).toThrow();
    });

    it('should reject user with invalid email format', () => {
      const invalid = { ...USERS_FIXTURE[0], email: 'not-an-email' };
      expect(() => UserSchema.parse(invalid)).toThrow();
    });

    it('should accept valid email formats', () => {
      const emails = [
        'user@example.com',
        'first.last@example.co.uk',
        'user+tag@example.com',
        'user_name@example.com',
      ];

      emails.forEach(email => {
        const user: User = {
          ...USERS_FIXTURE[0],
          email,
        };
        expect(() => UserSchema.parse(user)).not.toThrow();
      });
    });

    it('should reject user without displayName', () => {
      const invalid = { ...USERS_FIXTURE[0], displayName: undefined };
      expect(() => UserSchema.parse(invalid)).toThrow();
    });
  });

  describe('KitchenSettings Schema', () => {
    it('should validate settings fixture conforms to schema', () => {
      expect(() => KitchenSettingsSchema.parse(KITCHEN_SETTINGS_FIXTURE)).not.toThrow();
    });

    it('should have all required fields', () => {
      const settings = KITCHEN_SETTINGS_FIXTURE;
      expect(settings.directives).toBeDefined();
    });

    it('should reject settings without directives', () => {
      const invalid = { ...KITCHEN_SETTINGS_FIXTURE, directives: undefined };
      expect(() => KitchenSettingsSchema.parse(invalid)).toThrow();
    });

    it('should accept settings with empty userOrder', () => {
      const noOrder: KitchenSettings = {
        ...KITCHEN_SETTINGS_FIXTURE,
        userOrder: [],
      };
      expect(() => KitchenSettingsSchema.parse(noOrder)).not.toThrow();
    });

    it('should accept settings without userOrder', () => {
      const noOrder: KitchenSettings = {
        ...KITCHEN_SETTINGS_FIXTURE,
        userOrder: undefined,
      };
      expect(() => KitchenSettingsSchema.parse(noOrder)).not.toThrow();
    });

    it('should accept settings without debugEnabled', () => {
      const noDebug: KitchenSettings = {
        ...KITCHEN_SETTINGS_FIXTURE,
        debugEnabled: undefined,
      };
      expect(() => KitchenSettingsSchema.parse(noDebug)).not.toThrow();
    });

    it('should accept settings with debugEnabled true', () => {
      const debug: KitchenSettings = {
        ...KITCHEN_SETTINGS_FIXTURE,
        debugEnabled: true,
      };
      expect(() => KitchenSettingsSchema.parse(debug)).not.toThrow();
    });

    it('should accept settings with many users in order', () => {
      const manyUsers: KitchenSettings = {
        ...KITCHEN_SETTINGS_FIXTURE,
        userOrder: Array.from({ length: 50 }, (_, i) => `user-${i}`),
      };
      expect(() => KitchenSettingsSchema.parse(manyUsers)).not.toThrow();
    });
  });
});

// ============================================================================
// SECTION 3: Type Safety Tests
// ============================================================================

describe('AdminModule - Type Safety', () => {
  it('should maintain type safety with User', () => {
    const user: User = USERS_FIXTURE[0];
    expectTypeOf(user).toMatchTypeOf<User>();
  });

  it('should maintain type safety with KitchenSettings', () => {
    const settings: KitchenSettings = KITCHEN_SETTINGS_FIXTURE;
    expectTypeOf(settings).toMatchTypeOf<KitchenSettings>();
  });

  it('should maintain array type safety', () => {
    const users: User[] = USERS_FIXTURE;
    expectTypeOf(users).toMatchTypeOf<User[]>();
  });
});

// ============================================================================
// SECTION 4: Data Mutations & Transformations
// ============================================================================

describe('AdminModule - Data Mutations', () => {
  it('should validate user with updated displayName', () => {
    const updated: User = {
      ...USERS_FIXTURE[0],
      displayName: 'Executive Chef',
    };
    expect(() => UserSchema.parse(updated)).not.toThrow();
  });

  it('should validate user with updated email', () => {
    const updated: User = {
      ...USERS_FIXTURE[0],
      email: 'newemail@example.com',
    };
    expect(() => UserSchema.parse(updated)).not.toThrow();
  });

  it('should validate settings with updated directives', () => {
    const updated: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      directives: 'New culinary directives',
    };
    expect(() => KitchenSettingsSchema.parse(updated)).not.toThrow();
  });

  it('should validate settings with reordered users', () => {
    const updated: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      userOrder: ['user-3', 'user-1', 'user-2'],
    };
    expect(() => KitchenSettingsSchema.parse(updated)).not.toThrow();
  });

  it('should reject user with invalid email type', () => {
    const invalid = {
      ...USERS_FIXTURE[0],
      email: 12345 as any,
    };
    expect(() => UserSchema.parse(invalid)).toThrow();
  });

  it('should reject settings with invalid userOrder type', () => {
    const invalid = {
      ...KITCHEN_SETTINGS_FIXTURE,
      userOrder: 'user-1,user-2' as any,
    };
    expect(() => KitchenSettingsSchema.parse(invalid)).toThrow();
  });
});

// ============================================================================
// SECTION 5: Module Boundaries
// ============================================================================

describe('AdminModule - Module Boundaries', () => {
  it('should use only contract types', () => {
    const users: User[] = USERS_FIXTURE;
    const settings: KitchenSettings = KITCHEN_SETTINGS_FIXTURE;

    expectTypeOf(users).toMatchTypeOf<User[]>();
    expectTypeOf(settings).toMatchTypeOf<KitchenSettings>();
  });

  it('should not expose internal backend types', () => {
    const user = USERS_FIXTURE[0];
    expect('_id' in user).toBe(false);
    expect('_timestamp' in user).toBe(false);
    expect('__typename' in user).toBe(false);
  });
});

// ============================================================================
// SECTION 6: Data Consistency
// ============================================================================

describe('AdminModule - Data Consistency', () => {
  it('should maintain unique user IDs', () => {
    const ids = new Set(USERS_FIXTURE.map(u => u.id));
    expect(ids.size).toBe(USERS_FIXTURE.length);
  });

  it('should maintain unique user emails', () => {
    const emails = new Set(USERS_FIXTURE.map(u => u.email));
    expect(emails.size).toBe(USERS_FIXTURE.length);
  });

  it('should have valid users in settings order', () => {
    const userIds = new Set(USERS_FIXTURE.map(u => u.id));
    const settings = KITCHEN_SETTINGS_FIXTURE;

    if (settings.userOrder) {
      settings.userOrder.forEach(userId => {
        expect(userIds.has(userId)).toBe(true);
      });
    }
  });
});

// ============================================================================
// SECTION 7: Edge Cases & Boundaries
// ============================================================================

describe('AdminModule - Edge Cases', () => {
  it('should accept user with very long displayName', () => {
    const longName: User = {
      ...USERS_FIXTURE[0],
      displayName: 'A'.repeat(500),
    };
    expect(() => UserSchema.parse(longName)).not.toThrow();
  });

  it('should accept user with special characters in displayName', () => {
    const special: User = {
      ...USERS_FIXTURE[0],
      displayName: 'Chef José García-López',
    };
    expect(() => UserSchema.parse(special)).not.toThrow();
  });

  it('should accept user with unicode displayName', () => {
    const unicode: User = {
      ...USERS_FIXTURE[0],
      displayName: '日本料理シェフ',
    };
    expect(() => UserSchema.parse(unicode)).not.toThrow();
  });

  it('should accept settings with very long directives', () => {
    const longDirectives: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      directives: 'A'.repeat(10000),
    };
    expect(() => KitchenSettingsSchema.parse(longDirectives)).not.toThrow();
  });

  it('should accept settings with special characters in directives', () => {
    const special: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      directives: 'Use crème fraîche & citrus (lemon, lime, oranges).',
    };
    expect(() => KitchenSettingsSchema.parse(special)).not.toThrow();
  });

  it('should accept settings with unicode in directives', () => {
    const unicode: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      directives: '米は日本産、塩は海塩を使用してください。',
    };
    expect(() => KitchenSettingsSchema.parse(unicode)).not.toThrow();
  });

  it('should accept email with multiple subdomains', () => {
    const user: User = {
      ...USERS_FIXTURE[0],
      email: 'chef@mail.company.example.com',
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });

  it('should accept email with plus addressing', () => {
    const user: User = {
      ...USERS_FIXTURE[0],
      email: 'chef+salt@example.com',
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });

  it('should accept settings with duplicate users in order', () => {
    const dupUsers: KitchenSettings = {
      ...KITCHEN_SETTINGS_FIXTURE,
      userOrder: ['user-1', 'user-1', 'user-2'],
    };
    expect(() => KitchenSettingsSchema.parse(dupUsers)).not.toThrow();
  });

  it('should accept user with spaces in displayName', () => {
    const spaced: User = {
      ...USERS_FIXTURE[0],
      displayName: '  Head Chef  ',
    };
    expect(() => UserSchema.parse(spaced)).not.toThrow();
  });
});
