#!/usr/bin/env node

/**
 * Create test auth user in Firebase Emulator
 * Run this after starting emulators: npm run emulators
 * Usage: node scripts/create-auth-user.mjs
 */

import fetch from 'node-fetch';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const API_KEY = 'fake-api-key-for-emulator';
const EMAIL = 'dev@test.local';
const PASSWORD = 'dev-test-password-123';
const DISPLAY_NAME = 'Dev User';
const EMULATOR_AUTH_URL = 'http://127.0.0.1:9099';
const PROJECT_ID = 'gen-lang-client-0015061880';
const DATABASE_ID = 'saltstore';
const EMULATOR_HOST = '127.0.0.1:8080';

async function createTestUser() {
  try {
    console.log(`Creating test auth user: ${EMAIL}`);
    
    // 1. Create Firebase Auth user
    const response = await fetch(
      `${EMULATOR_AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
          returnSecureToken: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      
      // User already exists - this is fine
      if (error.error?.message?.includes('EMAIL_EXISTS')) {
        console.log(`✅ Auth user already exists: ${EMAIL}`);
      } else {
        console.error('❌ Error creating auth user:', error);
        process.exit(1);
      }
    } else {
      const data = await response.json();
      console.log(`✅ Auth user created: ${EMAIL}`);
      console.log(`   UID: ${data.localId}`);
    }

    // 2. Create Firestore user document
    process.env.FIRESTORE_EMULATOR_HOST = EMULATOR_HOST;
    const app = initializeApp({ projectId: PROJECT_ID });
    const db = getFirestore(app, DATABASE_ID);
    
    const userDoc = {
      email: EMAIL,
      displayName: DISPLAY_NAME,
    };
    
    await db.collection('users').doc(EMAIL).set(userDoc);
    console.log(`✅ Firestore user document created: ${EMAIL}`);
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error.message);
    console.error('\nNote: Make sure emulators are running:');
    console.error('  npm run emulators');
    process.exit(1);
  }
}

createTestUser();
