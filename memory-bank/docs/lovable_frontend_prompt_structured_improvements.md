# Lovable.dev Prompt: Structured Improvements & Language Enhancements

## Project Context

You are working on an **existing React + TypeScript + Supabase retail management application**. The following is already implemented:

### ✅ Already Built (DO NOT REBUILD)
- **Authentication System**: Complete with role-based access control
- **Master Dashboard**: Dashboard with metrics, AI tabs, navigation, monthly goals
- **CRUD Pages**: Stores, Inventory, Sales, Workers, Deliverers, Deliveries, Analytics
- **Store Detail Pages**: Deep dive into store information with workers, inventory, sales
- **Image Upload**: Product and store image management
- **Map Integration**: Delivery map with geocoding
- **Real-time Updates**: Delivery notifications and live updates
- **i18n Support**: Basic English, French, Bambara translations
- **Services**: `StoreService`, `InventoryService`, `SalesService`, `GoalService`, `ImageService`

### 🎯 What You Need to Build

1. **Enhanced Language Support** - Complete translations, date/number formatting, RTL support
2. **Data Export System** - Export sales, inventory, reports to CSV/Excel/PDF
3. **Advanced Search & Filtering** - Global search, advanced filters, saved filter presets
4. **Pagination & Performance** - Pagination for large lists, virtual scrolling, lazy loading
5. **Bulk Operations** - Batch actions for inventory, sales, workers
6. **Settings & Preferences** - User settings, preferences, theme customization
7. **Activity Log & Audit Trail** - Track changes, view history, audit reports
8. **Help & Documentation** - In-app help system, tooltips, user guides

---

## Task 1: Enhanced Language Support

### Requirements

**Complete Translation Coverage:**
- Translate ALL user-facing text (buttons, labels, messages, errors, tooltips)
- Add missing translations for new features
- Ensure consistency across all pages

**Date & Number Formatting:**
- Format dates according to locale (French: DD/MM/YYYY, English: MM/DD/YYYY)
- Format numbers with locale-specific separators (French: 1 234,56, English: 1,234.56)
- Format currency (XOF/FCFA for Mali, with proper symbols)

**RTL Support (if needed):**
- Support right-to-left languages if adding Arabic or Hebrew
- Mirror layouts for RTL languages

**Language-Specific Features:**
- Store language preference in user profile
- Auto-detect browser language on first visit
- Allow per-user language override

### Implementation Steps

#### 1. Complete Translation Files

**File**: `src/locales/en/translation.json` (expand existing)

Add missing keys for:
- All form labels and placeholders
- Error messages
- Success messages
- Tooltips
- Table headers
- Button labels
- Navigation items
- Status messages
- Validation messages

**File**: `src/locales/fr/translation.json` (expand existing)

**File**: `src/locales/bm/translation.json` (expand existing)

#### 2. Create Date/Number Formatting Utilities

**File**: `src/utils/formatting.ts`

```typescript
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

export function useFormatters() {
  const { i18n } = useTranslation();
  
  const formatDate = (date: string | Date, formatStr: string = 'PP') => {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const locale = i18n.language === 'fr' ? fr : enUS;
    return format(dateObj, formatStr, { locale });
  };
  
  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };
  
  const formatCurrency = (amount: number, currency: string = 'XOF') => {
    return new Intl.NumberFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  return { formatDate, formatNumber, formatCurrency };
}
```

#### 3. Update All Components to Use Formatters

Replace hardcoded date/number formatting with `useFormatters()` hook.

#### 4. Add Language Preference to User Profile

**Database Migration**: Add `language_preference` to `profiles` table

```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en';
```

**Update AuthContext**: Load and apply user's language preference on login.

---

## Task 2: Data Export System

### Requirements

**Export Formats:**
- **CSV** - For Excel compatibility
- **Excel (.xlsx)** - Formatted spreadsheets
- **PDF** - Formatted reports

**Exportable Data:**
- Sales (with filters: date range, store, worker)
- Inventory (with filters: store, category, low stock)
- Workers (with performance metrics)
- Deliveries (with filters: date range, status, store)
- Analytics/Reports (charts as images in PDF)

**Export Features:**
- Filter data before export
- Include metadata (export date, filters applied, user)
- Progress indicator for large exports
- Download or email export

### Implementation Steps

#### 1. Install Export Libraries

```bash
npm install papaparse xlsx jspdf jspdf-autotable
npm install @types/papaparse --save-dev
```

#### 2. Create Export Service

**File**: `src/services/ExportService.ts`

```typescript
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class ExportService {
  /**
   * Export data to CSV
   */
  static exportToCSV(data: any[], filename: string, headers?: string[]) {
    const csv = Papa.unparse(data, {
      columns: headers,
      header: true,
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  }
  
  /**
   * Export data to Excel
   */
  static exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${filename}.xlsx`);
  }
  
  /**
   * Export data to PDF
   */
  static exportToPDF(
    data: any[],
    filename: string,
    title: string,
    columns: { header: string; dataKey: string; width?: number }[]
  ) {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Exported on: ${new Date().toLocaleString()}`, 14, 22);
    
    // Add table
    autoTable(doc, {
      head: [columns.map(col => col.header)],
      body: data.map(row => columns.map(col => row[col.dataKey] || '')),
      startY: 30,
      styles: { fontSize: 8 },
      columnStyles: columns.reduce((acc, col, idx) => {
        if (col.width) acc[idx] = { cellWidth: col.width };
        return acc;
      }, {} as any),
    });
    
    doc.save(`${filename}.pdf`);
  }
  
  /**
   * Export sales data
   */
  static exportSales(sales: any[], filters?: any) {
    const data = sales.map(sale => ({
      Date: sale.sale_date,
      Item: sale.item?.name || '',
      Quantity: sale.quantity,
      Unit Price: sale.unit_price,
      Total: sale.total_price,
      Worker: sale.worker?.full_name || '',
      Store: sale.store?.name || '',
      Customer: sale.customer_name || '',
    }));
    
    return data;
  }
  
  // Similar methods for inventory, workers, deliveries
}
```

#### 3. Add Export Buttons to Pages

**Update**: `src/pages/master/Sales.tsx`, `Inventory.tsx`, `Workers.tsx`, `Deliveries.tsx`

Add export dropdown menu:
```typescript
import { ExportService } from '@/services/ExportService';
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';

// In component:
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">
      <Download className="h-4 w-4 mr-2" />
      Export
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onClick={() => ExportService.exportToCSV(exportData, 'sales')}>
      <FileText className="h-4 w-4 mr-2" />
      Export as CSV
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => ExportService.exportToExcel(exportData, 'sales')}>
      <FileSpreadsheet className="h-4 w-4 mr-2" />
      Export as Excel
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => ExportService.exportToPDF(exportData, 'sales', 'Sales Report', columns)}>
      <File className="h-4 w-4 mr-2" />
      Export as PDF
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Task 3: Advanced Search & Filtering

### Requirements

**Global Search:**
- Search across stores, inventory, sales, workers
- Search results grouped by type
- Quick navigation to results

**Advanced Filters:**
- Multiple filter criteria (date range, store, status, etc.)
- Filter combinations (AND/OR logic)
- Saved filter presets
- Clear all filters button

**Filter UI:**
- Filter panel/sidebar
- Active filters display (chips/badges)
- Filter count indicator

### Implementation Steps

#### 1. Create Search Service

**File**: `src/services/SearchService.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';

export class SearchService {
  static async globalSearch(query: string, userId: string) {
    const results = {
      stores: [],
      inventory: [],
      sales: [],
      workers: [],
    };
    
    // Search stores
    const { data: stores } = await supabase
      .from('stores')
      .select('*')
      .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
      .limit(10);
    
    // Search inventory
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*, stores(name)')
      .ilike('name', `%${query}%`)
      .limit(10);
    
    // Search sales
    const { data: sales } = await supabase
      .from('sales')
      .select('*, items(name), stores(name)')
      .or(`customer_name.ilike.%${query}%,notes.ilike.%${query}%`)
      .limit(10);
    
    // Search workers (via profiles and user_roles)
    // ... implementation
    
    return results;
  }
}
```

#### 2. Create Global Search Component

**File**: `src/components/shared/GlobalSearch.tsx`

- Search input with keyboard shortcut (Cmd/Ctrl + K)
- Results dropdown/modal
- Grouped results by type
- Click to navigate

#### 3. Create Advanced Filter Component

**File**: `src/components/shared/AdvancedFilters.tsx`

- Reusable filter component
- Date range picker
- Multi-select dropdowns
- Filter chips display
- Save/load filter presets

---

## Task 4: Pagination & Performance

### Requirements

**Pagination:**
- Page size selector (10, 25, 50, 100 items)
- Page navigation (first, prev, next, last)
- Current page indicator
- Total items count

**Performance Optimizations:**
- Virtual scrolling for large lists
- Lazy loading for images
- Debounced search inputs
- Cached API responses

### Implementation Steps

#### 1. Create Pagination Component

**File**: `src/components/shared/Pagination.tsx`

```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}
```

#### 2. Update Services to Support Pagination

**Update**: `SalesService`, `InventoryService`, etc.

Add pagination parameters:
```typescript
static async getSales(
  storeId?: string,
  limit?: number,
  offset?: number,
  filters?: any
): Promise<{ data?: SaleWithDetails[]; count?: number; error?: any }> {
  // ... implementation with count
}
```

#### 3. Add Pagination to List Pages

Update all list pages to use pagination component.

---

## Task 5: Bulk Operations

### Requirements

**Bulk Actions:**
- Select multiple items (checkboxes)
- Bulk delete (inventory, sales)
- Bulk update (inventory quantities, prices)
- Bulk assign (workers to stores, deliveries to deliverers)

**UI:**
- Select all checkbox
- Selected items count
- Bulk action toolbar
- Confirmation dialogs

### Implementation Steps

#### 1. Create Selection Hook

**File**: `src/hooks/useSelection.ts`

```typescript
export function useSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const toggleSelect = (id: string) => {
    // ... implementation
  };
  
  const selectAll = () => {
    // ... implementation
  };
  
  const clearSelection = () => {
    // ... implementation
  };
  
  return { selectedIds, toggleSelect, selectAll, clearSelection };
}
```

#### 2. Add Bulk Actions to Pages

Update Inventory, Sales, Workers pages with:
- Checkbox column
- Bulk action toolbar
- Bulk operation handlers

---

## Task 6: Settings & Preferences

### Requirements

**User Settings:**
- Language preference
- Date format preference
- Number format preference
- Currency preference
- Theme (light/dark mode)
- Notifications preferences
- Default filters

**Store Settings (Master only):**
- Default store
- Default currency
- Business hours
- Tax rates
- Low stock thresholds

### Implementation Steps

#### 1. Create Settings Service

**File**: `src/services/SettingsService.ts`

#### 2. Create Settings Page

**File**: `src/pages/master/Settings.tsx`

- User preferences form
- Store settings (if master)
- Save/load from database

#### 3. Add Settings to Navigation

Add Settings link to master layout navigation.

---

## Task 7: Activity Log & Audit Trail

### Requirements

**Track Changes:**
- Who made the change
- What was changed
- When it was changed
- Previous and new values

**Audit Log:**
- View activity log
- Filter by user, date, action type
- Export audit log

### Implementation Steps

#### 1. Database Migration

**File**: `supabase/migrations/20251106170000_activity_log.sql`

```sql
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'store', 'inventory', 'sale', etc.
  entity_id UUID NOT NULL,
  changes JSONB, -- { field: { old: value, new: value } }
  metadata JSONB, -- Additional context
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at);
```

#### 2. Create Activity Log Service

**File**: `src/services/ActivityLogService.ts`

#### 3. Create Activity Log Page

**File**: `src/pages/master/ActivityLog.tsx`

- Activity log table
- Filters (user, date, action type)
- Export functionality

#### 4. Add Logging to Services

Update services to log changes automatically.

---

## Task 8: Help & Documentation

### Requirements

**In-App Help:**
- Help button/menu
- Contextual tooltips
- User guides
- FAQ section
- Video tutorials (optional)

**Documentation:**
- Feature documentation
- How-to guides
- Keyboard shortcuts
- Troubleshooting

### Implementation Steps

#### 1. Create Help Component

**File**: `src/components/shared/HelpCenter.tsx`

- Help modal/drawer
- Searchable help content
- Categories (Getting Started, Features, Troubleshooting)

#### 2. Add Tooltips

Use shadcn/ui Tooltip component for:
- Form field help
- Button descriptions
- Feature explanations

#### 3. Create Help Content

**File**: `src/content/help/` (markdown files or JSON)

- Getting started guide
- Feature documentation
- FAQ

---

## Implementation Checklist

### Task 1: Enhanced Language Support
- [ ] Complete all translation files (en, fr, bm)
- [ ] Create formatting utilities
- [ ] Update all components to use formatters
- [ ] Add language preference to profile
- [ ] Test date/number formatting
- [ ] Test currency formatting

### Task 2: Data Export System
- [ ] Install export libraries
- [ ] Create ExportService
- [ ] Add export buttons to Sales page
- [ ] Add export buttons to Inventory page
- [ ] Add export buttons to Workers page
- [ ] Add export buttons to Deliveries page
- [ ] Add export to Analytics/Reports
- [ ] Test CSV export
- [ ] Test Excel export
- [ ] Test PDF export

### Task 3: Advanced Search & Filtering
- [ ] Create SearchService
- [ ] Create GlobalSearch component
- [ ] Create AdvancedFilters component
- [ ] Add global search to layout
- [ ] Add advanced filters to list pages
- [ ] Implement filter presets
- [ ] Test search functionality

### Task 4: Pagination & Performance
- [ ] Create Pagination component
- [ ] Update services to support pagination
- [ ] Add pagination to Sales page
- [ ] Add pagination to Inventory page
- [ ] Add pagination to Workers page
- [ ] Add pagination to Deliveries page
- [ ] Implement virtual scrolling (optional)
- [ ] Add loading optimizations

### Task 5: Bulk Operations
- [ ] Create useSelection hook
- [ ] Add selection to Inventory page
- [ ] Add selection to Sales page
- [ ] Add selection to Workers page
- [ ] Implement bulk delete
- [ ] Implement bulk update
- [ ] Add bulk action toolbar
- [ ] Test bulk operations

### Task 6: Settings & Preferences
- [ ] Create SettingsService
- [ ] Create Settings page
- [ ] Add user preferences form
- [ ] Add store settings (master)
- [ ] Add settings to navigation
- [ ] Save/load preferences
- [ ] Apply preferences globally

### Task 7: Activity Log & Audit Trail
- [ ] Create activity_log table migration
- [ ] Create ActivityLogService
- [ ] Create ActivityLog page
- [ ] Add logging to services
- [ ] Add activity log to navigation
- [ ] Test audit trail
- [ ] Add export for audit log

### Task 8: Help & Documentation
- [ ] Create HelpCenter component
- [ ] Add help content
- [ ] Add tooltips to forms
- [ ] Add help button to layout
- [ ] Create FAQ section
- [ ] Add keyboard shortcuts guide

---

## Design Guidelines

### Language Support
- **Consistency**: Use same terminology across all pages
- **Context**: Provide context for translations (e.g., "Save" vs "Save Changes")
- **Length**: Consider text length differences (French/Bambara may be longer)

### Export System
- **Progress**: Show progress for large exports
- **Formatting**: Preserve formatting in exports
- **Metadata**: Include export metadata (date, user, filters)

### Search & Filtering
- **Performance**: Debounce search inputs (300ms)
- **Feedback**: Show loading state during search
- **Empty States**: Show helpful messages when no results

### Pagination
- **Mobile**: Use compact pagination on mobile
- **Accessibility**: Ensure keyboard navigation works
- **Performance**: Load data incrementally

### Bulk Operations
- **Confirmation**: Always confirm destructive bulk actions
- **Feedback**: Show progress and results
- **Undo**: Consider undo functionality for bulk deletes

### Settings
- **Persistence**: Save settings immediately
- **Validation**: Validate settings before saving
- **Defaults**: Provide sensible defaults

### Activity Log
- **Performance**: Paginate activity log
- **Filtering**: Allow filtering by multiple criteria
- **Privacy**: Respect user privacy (hide sensitive data)

### Help & Documentation
- **Accessibility**: Make help accessible (keyboard shortcuts)
- **Search**: Allow searching help content
- **Context**: Show contextual help based on current page

---

## Important Notes

1. **Performance**: All new features should be optimized for mobile devices
2. **Accessibility**: Follow WCAG guidelines for accessibility
3. **Error Handling**: Provide clear error messages in user's language
4. **Testing**: Test all features with different languages
5. **Backward Compatibility**: Ensure new features don't break existing functionality

---

## Getting Started

1. **Start with Language Support** - Most foundational, affects all other features
2. **Add Export System** - High value, relatively straightforward
3. **Implement Search & Filtering** - Improves UX significantly
4. **Add Pagination** - Essential for performance
5. **Build Bulk Operations** - Saves time for users
6. **Create Settings** - Allows customization
7. **Add Activity Log** - Important for audit/compliance
8. **Build Help System** - Improves user onboarding

Good luck building! Remember to test each feature thoroughly and ensure translations are complete.




