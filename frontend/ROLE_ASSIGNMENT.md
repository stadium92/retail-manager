# Role Assignment System

## Overview

The Retail Manager application uses an intelligent role assignment system that automatically assigns user roles based on email addresses. This ensures that users get the correct access level without manual intervention.

## Role Assignment Methods

The system supports multiple methods for role assignment, checked in priority order:

### 1. Environment Variables (Highest Priority)

Specific emails can be configured in environment variables for precise control:

```env
# Master emails (comma-separated)
VITE_MASTER_EMAILS=admin@example.com,owner@example.com,manager@example.com

# Worker emails (comma-separated)
VITE_WORKER_EMAILS=worker1@example.com,worker2@example.com,employee@example.com

# Deliverer emails (comma-separated)
VITE_DELIVERER_EMAILS=deliverer1@example.com,deliverer2@example.com,driver@example.com
```

**Advantages:**
- Precise control over specific emails
- Easy to manage in production
- Secure (not exposed in code)

### 2. Email Domain Patterns

Emails matching specific domain patterns are automatically assigned roles:

**Master Role Patterns:**
- `@master.*` (e.g., `john@master.company.com`)
- `@admin.*` (e.g., `jane@admin.company.com`)
- `@owner.*` (e.g., `bob@owner.company.com`)
- `@manager.*` (e.g., `alice@manager.company.com`)
- `master@*` (e.g., `master@company.com`)
- `admin@*` (e.g., `admin@company.com`)
- `owner@*` (e.g., `owner@company.com`)
- `manager@*` (e.g., `manager@company.com`)

**Worker Role Patterns:**
- `@worker.*` (e.g., `john@worker.company.com`)
- `@employee.*` (e.g., `jane@employee.company.com`)
- `@staff.*` (e.g., `bob@staff.company.com`)
- `worker@*` (e.g., `worker@company.com`)
- `employee@*` (e.g., `employee@company.com`)
- `staff@*` (e.g., `staff@company.com`)

**Deliverer Role Patterns:**
- `@deliverer.*` (e.g., `john@deliverer.company.com`)
- `@delivery.*` (e.g., `jane@delivery.company.com`)
- `@driver.*` (e.g., `bob@driver.company.com`)
- `deliverer@*` (e.g., `deliverer@company.com`)
- `delivery@*` (e.g., `delivery@company.com`)
- `driver@*` (e.g., `driver@company.com`)

**Advantages:**
- Automatic assignment based on email structure
- Scalable for organizations with structured email domains
- No manual configuration needed

### 3. Default (Customer)

If an email doesn't match any pattern or environment variable, it defaults to `customer` role (public access).

## Setup Instructions

### Step 1: Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your email configurations:
   ```env
   VITE_MASTER_EMAILS=admin@yourcompany.com,owner@yourcompany.com
   VITE_WORKER_EMAILS=worker1@yourcompany.com,worker2@yourcompany.com
   VITE_DELIVERER_EMAILS=deliverer1@yourcompany.com,deliverer2@yourcompany.com
   ```

3. Restart your development server after changing environment variables.

### Step 2: Configure Email Domain Patterns (Optional)

If you want to use email domain patterns, you can modify `src/utils/roleAssignment.ts`:

```typescript
const EMAIL_PATTERNS: Record<AppRole, (string | RegExp)[]> = {
  master: [
    /@yourcompany\.com$/i,  // All emails from yourcompany.com
    /^admin@/i,              // Emails starting with admin@
  ],
  // ... other patterns
};
```

### Step 3: Test Role Assignment

1. Sign up with different email addresses
2. Check the browser console for role assignment logs
3. Verify users are redirected to the correct dashboard

## Examples

### Example 1: Environment Variable Configuration

```env
VITE_MASTER_EMAILS=john@example.com,jane@example.com
```

When `john@example.com` or `jane@example.com` signs up, they automatically get the `master` role.

### Example 2: Email Domain Pattern

If a user signs up with `admin@company.com`, they automatically get the `master` role because it matches the `admin@*` pattern.

### Example 3: Worker Email Pattern

If a user signs up with `worker1@worker.company.com`, they automatically get the `worker` role because it matches the `@worker.*` pattern.

## Role Assignment Priority

The system checks role assignment in this order:

1. **Environment Variables** - Check if email is in `VITE_MASTER_EMAILS`, `VITE_WORKER_EMAILS`, or `VITE_DELIVERER_EMAILS`
2. **Email Patterns** - Check if email matches any configured pattern (master > worker > deliverer)
3. **Default** - Assign `customer` role if no match found

## Manual Role Assignment

If you need to manually assign roles (e.g., for existing users), you can do so in the database:

```sql
-- Assign master role
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'master', 'store-uuid');

-- Assign worker role
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'worker', 'store-uuid');

-- Assign deliverer role
INSERT INTO user_roles (user_id, role, store_id)
VALUES ('user-uuid', 'deliverer', 'store-uuid');
```

## Security Considerations

1. **Environment Variables**: Keep your `.env` file secure and never commit it to version control
2. **Email Patterns**: Be careful with regex patterns to avoid unintended matches
3. **Default Role**: The default `customer` role has minimal access, which is secure
4. **Role Changes**: Users can have multiple roles, but the primary role determines their default dashboard

## Troubleshooting

### Issue: User not getting expected role

1. Check browser console for role assignment logs
2. Verify email is in environment variables (if using that method)
3. Check if email matches any configured patterns
4. Verify `.env` file is loaded correctly (restart dev server)

### Issue: Environment variables not working

1. Ensure variables start with `VITE_` prefix
2. Restart development server after changing `.env`
3. Check that `.env` file is in the correct location (frontend root)

### Issue: Pattern not matching

1. Check regex pattern syntax in `roleAssignment.ts`
2. Test pattern with a regex tester
3. Check browser console for pattern matching logs

## Best Practices

1. **Use Environment Variables for Production**: More secure and easier to manage
2. **Use Patterns for Development**: Faster setup for testing
3. **Document Your Configuration**: Keep track of which emails have which roles
4. **Regular Audits**: Periodically review role assignments
5. **Backup Configuration**: Keep a backup of your `.env` file

