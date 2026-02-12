# SALT - Production Deployment Guide

This document covers the deployment strategy for taking Salt from local Firebase emulators to production Firebase hosting.

## Pre-Deployment Checklist

### Firebase Configuration
- [ ] Production Firebase project created
- [ ] Firestore security rules reviewed and deployed
- [ ] Firebase Storage CORS and quotas configured
- [ ] Firebase Functions deployed with correct region settings
- [ ] Environment variables configured in Functions (`GEMINI_API_KEY`)

### Security & Authentication
- [ ] Firestore rules enforce authentication (`isAuthorized()`)
- [ ] Storage rules enforce authentication and file type validation
- [ ] Passwordless email authentication configured
- [ ] Email templates customized for production domain
- [ ] User collection structure matches emulator schema

### Monitoring & Logging
- [ ] Google Cloud logging configured
- [ ] Firebase Performance Monitoring enabled
- [ ] Error tracking setup (Cloud Functions logs)
- [ ] Budget alerts configured for API usage (Gemini, Firebase)

### Data Migration
- [ ] Export complete system state from emulator (Admin → Export Backup)
- [ ] Validate JSON manifest structure matches current schema
- [ ] Test import on clean production Firestore instance
- [ ] Verify all image references resolve correctly

## Deployment Steps

### 1. Deploy Firebase Resources
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage

# Deploy Functions
cd functions && npm install && cd ..
firebase deploy --only functions

# Deploy hosting (if using Firebase Hosting)
firebase deploy --only hosting
```

### 2. Verify Deployment
- Test user authentication flow (passwordless email)
- Create test recipe with image upload
- Verify Gemini AI integration via Functions proxy
- Test offline persistence (disconnect network, modify data, reconnect)
- Export system state and verify data integrity

### 3. Data Migration (if needed)
1. Log into production app with admin account
2. Navigate to Admin panel
3. Import backup JSON from emulator environment
4. Verify all recipes, equipment, plans appear correctly
5. Check that images load (storage paths correct)

## Post-Deployment Validation

### Functional Testing
1. **Authentication:** User can sign in via passwordless email link
2. **Recipe Module:** Create, edit, delete recipes; generate with AI
3. **Inventory Module:** Add equipment, AI candidate search works
4. **Planner Module:** Create meal plans, weekly view functions
5. **Admin Module:** Export/import, debug logging toggle works
6. **Image Handling:** Upload recipe images, images load on recipe detail
7. **Offline Mode:** App works offline, syncs when reconnected

### Performance Monitoring
1. Check Firebase Console for Firestore read/write patterns
2. Monitor Cloud Functions execution time and memory usage
3. Review Gemini API quota consumption
4. Check Firebase Storage bandwidth usage
5. Set up budget alerts if not already configured

### Data Integrity
1. Export a backup from production to verify export works
2. Compare record counts (recipes, equipment, plans) with expected values
3. Verify no Firebase Timestamps leaked (all dates should be ISO 8601 strings)
4. Check that Zod validation isn't throwing errors (enable debug logging temporarily)

## Production Maintenance

### Regular Backups
Schedule weekly backups:
1. Log into production app
2. Admin panel → Export Backup
3. Save JSON to secure location (Google Drive, GitHub private repo, etc.)
4. Consider automating with Cloud Scheduler + Cloud Function

### Monitoring Checklist (Weekly)
- Review Cloud Functions error logs
- Check Firestore query performance
- Monitor Gemini API usage vs. quota
- Review user authentication issues
- Check Storage usage trends

### Updates & Deployments
When deploying code updates:
1. Test thoroughly in local emulator environment
2. Export backup from production before deployment
3. Deploy during low-usage hours (if applicable)
4. Monitor error logs for 1 hour post-deployment
5. Keep rollback plan ready (redeploy previous Functions version)

## Rollback Plan

In case of critical issues after deployment:

### Quick Rollback (Functions Only)
```bash
# Rollback to previous Functions deployment
firebase functions:rollback
```

### Full Rollback (All Resources)
1. Redeploy previous version from git:
   ```bash
   git checkout <previous-working-commit>
   firebase deploy
   ```

2. If data corruption occurred:
   - Restore from most recent backup JSON
   - Import via Admin panel
   - Verify data integrity

3. If Firestore rules are broken:
   ```bash
   git checkout <previous-working-commit> firestore.rules
   firebase deploy --only firestore:rules
   ```

### Data Recovery
- Production backups stored in: _(document your backup location)_
- Access to Firebase Console: _(document who has access)_
- Firestore exports configured: _(yes/no, schedule)_

## Emergency Procedures

**System completely unavailable:**
1. Check Firebase status page: https://status.firebase.google.com
2. Review Cloud Functions logs for errors
3. Verify Firestore rules haven't locked out all users
4. Check billing/quota limits haven't been exceeded

**AI not responding:**
1. Verify Gemini API key is valid in Functions config
2. Check API quota hasn't been exceeded
3. Review Cloud Functions logs for specific errors
4. Test with simpler prompts to isolate issue

**Data loss reported:**
1. DO NOT attempt immediate fixes
2. Export current production state
3. Retrieve most recent backup
4. Compare backup with current state to identify discrepancy
5. Restore from backup only if data loss confirmed

## References

- [Firebase Backend Implementation](../architecture/firebase-backend-implementation.md)
- [Backend Guidelines](../architecture/backend-guidelines.md)
- [Change Management](../development/change-management.md)
- Firebase Console: https://console.firebase.google.com
- Google Cloud Console: https://console.cloud.google.com

## Production Environment Variables

Document your production configuration:

```bash
# Firebase Project
FIREBASE_PROJECT_ID=your-prod-project-id

# Functions Environment (.env.local in functions/)
GEMINI_API_KEY=your_production_gemini_key

# Web App (.env.production)
VITE_FIREBASE_PROJECT_ID=your-prod-project-id
VITE_FIREBASE_APP_ID=your-app-id
# ... other Firebase config values
```

---

**Important:** Always test deployments in a staging Firebase project before deploying to production. Never deploy untested code directly to production.
