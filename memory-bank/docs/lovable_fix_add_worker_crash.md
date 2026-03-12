# Lovable Prompt: Fix "Add Worker" Button Crash

## Issue
The "Add Worker" button crashes the app with error: `A <Select.Item /> must have a value prop that is not an empty string.`

## Fix Required

In `src/components/master/Team/AddWorkerDialog.tsx`, update the store selection dropdown:

### Change This:
```tsx
<SelectContent>
  <SelectItem value="">{t('team.form.noStore')}</SelectItem>
  {stores.map((store) => (
    <SelectItem key={store.id} value={store.id}>
      {store.name}
    </SelectItem>
  ))}
</SelectContent>
```

### To This:
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

### And Update the Submit Handler:
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
    // ... rest unchanged
  }
};
```

## Also Fix RLS Policy

Add this SQL policy to allow Masters to create stores:

```sql
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
```

## Why This Fixes It
Radix UI's `<Select.Item>` component does not allow empty strings for the `value` prop. Using `"none"` as a placeholder value and filtering it out during submission solves the crash.
