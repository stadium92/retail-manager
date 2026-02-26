# Prompt: Fix Hidden/Clipped Submenus in Menubar

**Context**: The application uses the `shadcn/ui` Menubar component. The user is reporting that submenus (e.g., "Situation CLIENT" inside "Edition") are cut off or hidden when hovered.
**Root Cause**: The `MenubarContent` component has `overflow-hidden` styling. Since `MenubarSubContent` is currently rendered *inside* that container (without a Portal), it gets clipped when it tries to extend beyond the parent's bounds.

**Objective**: Update the shared UI component to ensure submenus render in a Portal (attached to the document body), escaping any clipping from parent containers.

## Instructions

1.  Open **`src/components/ui/menubar.tsx`**.
2.  Locate the `MenubarSubContent` component definition (around line 65).
3.  Wrap the returned `MenubarPrimitive.SubContent` element with `<MenubarPrimitive.Portal>`.

**Code Change Reference**:

```tsx
const MenubarSubContent = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  // [ADD] Wrap in Portal to escape overflow-hidden of parent
  <MenubarPrimitive.Portal> 
    <MenubarPrimitive.SubContent
      ref={ref}
      className={cn(
        // ... kept existing classes ...
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </MenubarPrimitive.Portal>
));
```

4.  Save the file. This should instantly fix the clipping issue for all submenus across the application.
