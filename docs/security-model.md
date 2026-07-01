# Security Model

## Authentication and Sessions

- Local account-based authentication.
- Session token model with invalidation on password change.
- Temporary local lockout after repeated failed logins.

## Authorization

- First user becomes admin.
- Admins can manage users and global settings.
- Standard users are restricted by permissions and ownership scope.
- `viewAllData` permission enables broader visibility when explicitly granted.

## Recovery

- Password recovery uses local recovery codes.
- Recovery codes are invalidated after successful use.

## Auditability

- Administrative operations are logged locally in `admin_events`.

## Desktop Threat Model

- Optimized for local desktop execution at `127.0.0.1`.
- Not designed as a public internet-facing SaaS security model.
