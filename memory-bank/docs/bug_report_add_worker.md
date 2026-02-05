# Bug Report: "Add Worker" Button Crashes App (UPDATED)

## Issue Summary
Clicking the "Add Worker" button causes the entire React application to crash with an error boundary screen showing "Something went wrong."

## Root Cause (UPDATED)
The issue is **NOT** with the Edge Function. The problem is in the **frontend UI code**:

### Error Message
```
Error: A <Select.Item /> must have a value prop that is not an empty string.
```

### Location
`AddWorkerDialog.tsx` - The store selection dropdown

### Why It Happens
The Radix UI `<Select.Item>` component requires a non-empty string for the `value` prop. The current code likely has:

```tsx
<SelectItem value="">{t('team.form.noStore')}</SelectItem>
```

This empty string value is **not allowed** by Radix UI and causes the crash.

## Secondary Issue: Cannot Create Stores
When attempting to create a store to populate the dropdown, the following error occurs:

**Error**: `42501 - new row violates row-level security policy for table "stores"`

**Cause**: The RLS policies on the `stores` table are not configured to allow the Master user to insert new stores.

## Fixes Required

### Fix 1: Update `AddWorkerDialog.tsx`

Replace the empty string with a valid placeholder value:

```tsx
<SelectContent>
  <SelectItem value="none">{t('team.form.noStore')}</SelectItem>
  {stores.map((store) => (
    <SelectItem key={store.id} value={store.id}>
      {store.name}
    </SelectItem>
  ))}
</SelectContent>
```

Then update the form submission logic to handle "none":

```tsx
const onSubmit = async (data: WorkerFormData) => {
  setSubmitting(true);
  try {
    const { error } = await TeamService.createUser({
      email: data.email,
      password: data.password,
      full_name: data.full_name,
      phone: data.phone || undefined,
      role: 'worker',
      store_id: data.store_id === 'none' ? undefined : data.store_id,
    });
    // ... rest of the code
  }
};
```

### Fix 2: Update RLS Policies for `stores` Table

Add an RLS policy to allow Masters to insert stores:

```sql
-- Allow Masters to create stores
CREATE POLICY "Masters can insert stores"
ON stores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'master'
  )
);

-- Allow Masters to view their own stores
CREATE POLICY "Masters can view their stores"
ON stores
FOR SELECT
TO authenticated
USING (
  master_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'master'
  )
);
```

### Fix 3: Alternative - Make Store Selection Optional

If stores are not critical for worker creation, you could make the field truly optional:

```tsx
<FormField
  control={form.control}
  name="store_id"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('team.form.assignStore')} (Optional)</FormLabel>
      <Select 
        onValueChange={field.onChange} 
        value={field.value || "none"}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder={t('team.form.selectStore')} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="none">{t('team.form.noStore')}</SelectItem>
          {stores?.length > 0 ? (
            stores.map((store) => (
              <SelectItem key={store.id} value={store.id}>
                {store.name}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="none" disabled>
              {t('team.form.noStoresAvailable')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

## Testing Steps

1. **Test Fix 1**: 
   - Navigate to Team page
   - Click "Add Worker"
   - Verify the dialog opens without crashing
   - Select "No Store" option
   - Fill in worker details and submit
   - Verify worker is created successfully

2. **Test Fix 2**:
   - Navigate to Stores page
   - Click "Add Store"
   - Create a store named "Main Store"
   - Verify store is created without RLS errors
   - Go to Team page
   - Click "Add Worker"
   - Verify the new store appears in the dropdown

## Evidence

### Screenshot of Crash
![Error Boundary Screen](file:///Users/mohamedcoulibaly/.gemini/antigravity/brain/f23b53ae-aefa-428f-a2eb-b5f0e062f056/.system_generated/click_feedback/click_feedback_1768757262516.png)

### Console Error
```
Error: A <Select.Item /> must have a value prop that is not an empty string.
    at SelectItem (radix-ui component)
    at AddWorkerDialog
```

### RLS Error
```
{
  "code": "42501",
  "message": "new row violates row-level security policy for table \"stores\""
}
```

## Priority
**HIGH** - This is a blocking bug that prevents the core Team Management feature from working.

## Notes
- The Edge Function `create-user` that Lovable created is actually correct and working fine
- The issue is purely in the frontend UI validation
- This is a common Radix UI gotcha that many developers encounter
