
# SALT - Migration Roadmap (DEPLOYMENT)

**See also:** [Firebase Backend Implementation](../architecture/firebase-backend-implementation.md) for detailed technical requirements.

This document covers the deployment and production migration strategy for Salt.

## Pre-Production Checklist

- [ ] All parity tests passing (`npm run parity:relax`)
- [ ] Firestore security rules reviewed and finalized
- [ ] Firebase Storage quotas configured
- [ ] Google Cloud logging and monitoring configured
- [ ] Data backup and export strategy documented
- [ ] User authentication provider configured (Google, Email/Password, or both)

## Post-Deployment Validation

1. **Export a manifest from Simulation** and verify it can be restored in Firebase
2. **Test user login** against the production Firestore `users` collection
3. **Verify image uploads** work and resolve via `getDownloadURL()`
4. **Monitor Firestore read/write operations** for anomalies in Cloud Logging
5. **Schedule weekly backups** of Firestore

## Rollback Plan

In case of critical issues:
1. Revert `VITE_BACKEND_MODE=simulation` in `.env`
2. Redeploy web application
3. Keep Firebase Firestore data intact for investigation
4. Use exported manifests to restore state if needed

## References

- [Firebase Backend Implementation](../architecture/firebase-backend-implementation.md)
- [Migration Roadmap (Protocol)](../architecture/firebase-backend-implementation.md#phase-1-authentication-family-only)
