# Production Release Gates

A release is eligible for a client deployment only when all gates pass.

1. `npx tsc --noEmit` completes without errors.
2. The production build completes without warnings treated as errors.
3. Database migrations apply successfully to a clean test project.
4. Authentication, two-stage onboarding, role isolation, and villa isolation pass.
5. Finance and purchasing transaction tests pass without manual database repair.
6. No critical or high dependency vulnerability remains without written acceptance.
7. Backup restore is rehearsed and documented.
8. Production secrets are unique, rotated, and absent from source control.
9. Desktop and mobile acceptance tests pass.
10. The release has a Git tag and rollback instructions.
