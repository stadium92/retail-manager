# Security Concerns & Recommendations

## 🚨 Critical Security Issues

### 1. **Client-Side Role Assignment (HIGH RISK)**

**Current Issue:**
- Role assignment happens entirely on the client side
- Environment variables (`VITE_*`) are exposed in the JavaScript bundle
- Anyone can inspect the code and see master email patterns
- Users could potentially manipulate role assignment

**Risk:**
- Attackers can see all master emails by inspecting the bundle
- Role assignment logic can be bypassed
- No server-side validation

**Recommendation:**
- Move role assignment to server-side (database trigger or API endpoint)
- Use server-side environment variables (not `VITE_*`)
- Implement database-level validation

### 2. **RLS Policy Conflict (HIGH RISK)**

**Current Issue:**
- RLS policy for `user_roles` INSERT only allows masters to insert roles
- But client-side code tries to insert roles during signup
- This could fail silently or be blocked

**Risk:**
- Signup might fail for non-master users
- Inconsistent role assignment

**Recommendation:**
- Create a database trigger or function for automatic role assignment
- Allow role assignment during signup via trigger
- Restrict manual role changes to masters only

### 3. **Environment Variable Exposure (MEDIUM RISK)**

**Current Issue:**
- `VITE_MASTER_EMAILS`, `VITE_WORKER_EMAILS`, etc. are bundled into client code
- Anyone can extract these from the JavaScript bundle

**Risk:**
- Master emails are publicly visible
- Attackers know which emails have elevated privileges

**Recommendation:**
- Never use `VITE_*` for sensitive data
- Use server-side environment variables
- Implement server-side role assignment

### 4. **No Server-Side Validation (HIGH RISK)**

**Current Issue:**
- Role assignment is not validated on the server
- Client can potentially manipulate the assigned role

**Risk:**
- Users could escalate their privileges
- No verification of role assignment rules

**Recommendation:**
- Implement database triggers for role assignment
- Add server-side validation functions
- Log all role assignments

### 5. **No Audit Logging (MEDIUM RISK)**

**Current Issue:**
- No tracking of who assigned what role to whom
- No audit trail for security investigations

**Risk:**
- Cannot track privilege escalations
- Difficult to investigate security incidents

**Recommendation:**
- Create audit log table
- Log all role assignments and changes
- Track who made changes and when

## 🔒 Recommended Security Improvements

### Solution 1: Database Trigger for Role Assignment (RECOMMENDED)

Create a database trigger that automatically assigns roles based on email patterns:

```sql
-- Create function to assign role based on email
CREATE OR REPLACE FUNCTION public.assign_role_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  user_email TEXT;
  assigned_role public.app_role;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Assign role based on email (server-side logic)
  -- This logic should match your business rules
  IF user_email LIKE '%@master.%' OR user_email LIKE 'master@%' THEN
    assigned_role := 'master';
  ELSIF user_email LIKE '%@worker.%' OR user_email LIKE 'worker@%' THEN
    assigned_role := 'worker';
  ELSIF user_email LIKE '%@deliverer.%' OR user_email LIKE 'deliverer@%' THEN
    assigned_role := 'deliverer';
  ELSE
    assigned_role := 'customer';
  END IF;
  
  -- Insert role assignment
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profile creation
CREATE TRIGGER assign_role_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_role_on_signup();
```

### Solution 2: Secure Role Assignment Table

Create a configuration table for role assignment rules (server-side only):

```sql
-- Create role assignment rules table (only accessible by admins)
CREATE TABLE public.role_assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_pattern TEXT NOT NULL,
  role public.app_role NOT NULL,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.role_assignment_rules ENABLE ROW LEVEL SECURITY;

-- Only masters can view/manage rules
CREATE POLICY "Masters can manage role rules"
ON public.role_assignment_rules FOR ALL
USING (public.has_role(auth.uid(), 'master'));
```

### Solution 3: API Endpoint for Role Assignment

Create a secure API endpoint (if using a backend):

```typescript
// Backend API endpoint
POST /api/auth/assign-role
{
  "email": "user@example.com",
  "userId": "uuid"
}

// Server-side validation
function assignRole(email: string, userId: string): AppRole {
  // Check server-side environment variables
  const masterEmails = process.env.MASTER_EMAILS?.split(',') || [];
  if (masterEmails.includes(email)) return 'master';
  
  // Check patterns (server-side only)
  if (email.match(/@master\./i)) return 'master';
  if (email.match(/@worker\./i)) return 'worker';
  // ...
  
  return 'customer';
}
```

### Solution 4: Enhanced RLS Policies

Update RLS policies to allow role assignment during signup:

```sql
-- Allow users to insert their own role during signup
CREATE POLICY "Users can insert their own role on signup"
ON public.user_roles FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  -- Only allow if user doesn't already have a role
  NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  )
);

-- Masters can manage all roles
CREATE POLICY "Masters can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'master'));
```

### Solution 5: Audit Logging

Create audit log for role assignments:

```sql
-- Create audit log table
CREATE TABLE public.role_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  assigned_role public.app_role,
  assigned_by UUID REFERENCES auth.users(id),
  assignment_method TEXT, -- 'signup', 'manual', 'trigger', etc.
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create function to log role assignments
CREATE OR REPLACE FUNCTION public.log_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.role_audit_log (
    user_id,
    assigned_role,
    assigned_by,
    assignment_method,
    email
  )
  VALUES (
    NEW.user_id,
    NEW.role,
    auth.uid(),
    'signup',
    (SELECT email FROM auth.users WHERE id = NEW.user_id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER log_role_assignment_trigger
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.log_role_assignment();
```

## 🛡️ Immediate Actions Required

### Priority 1: Fix RLS Policy
1. Update `user_roles` INSERT policy to allow signup role assignment
2. Test that signup works for all role types

### Priority 2: Move Role Assignment to Server
1. Create database trigger for role assignment
2. Remove client-side role assignment logic
3. Keep client-side logic only for UI hints (not actual assignment)

### Priority 3: Secure Environment Variables
1. Remove sensitive emails from `VITE_*` variables
2. Use server-side environment variables only
3. Document which variables are safe for client-side

### Priority 4: Add Audit Logging
1. Create audit log table
2. Log all role assignments
3. Create admin interface to view audit logs

## 📋 Security Checklist

- [ ] Move role assignment to database trigger
- [ ] Remove `VITE_*` variables for sensitive data
- [ ] Fix RLS policies for signup
- [ ] Add audit logging
- [ ] Implement rate limiting on signup
- [ ] Add email verification requirement
- [ ] Create admin interface for role management
- [ ] Document security architecture
- [ ] Regular security audits
- [ ] Penetration testing

## 🔐 Best Practices Going Forward

1. **Never trust the client** - Always validate on server
2. **Principle of least privilege** - Default to lowest access level
3. **Defense in depth** - Multiple layers of security
4. **Audit everything** - Log all security-sensitive operations
5. **Regular reviews** - Periodic security audits
6. **Secure by default** - Fail securely, not permissively

