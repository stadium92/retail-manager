# Business Logic Implementation Specification

## 1. Gestion > Dashboard (CA)
**Objective**: Real-time sales aggregation.

### Backend Logic (SQLite)
```sql
-- Daily CA
SELECT SUM(total_amount) as ca_day FROM sales 
WHERE date(created_at) = date('now');

-- Weekly Trend
SELECT date(created_at) as sale_date, SUM(total_amount) as daily_total
FROM sales
WHERE created_at >= date('now', '-7 days')
GROUP BY date(created_at);
```

## 2. Gestion > Statistiques
**Objective**: Deep insights without heavy JS processing.

### Top Products
```sql
SELECT p.name, SUM(si.quantity) as volume, SUM(si.total_price) as revenue
FROM sale_items si
JOIN products p ON si.product_id = p.id
GROUP BY p.id
ORDER BY volume DESC
LIMIT 10;
```

### Busy Hours (Heatmap)
```sql
SELECT strftime('%H', created_at) as hour_slot, COUNT(*) as transaction_count
FROM sales
GROUP BY hour_slot
ORDER BY hour_slot;
```

## 3. Stock > Valorisation
**Objective**: Instant financial inventory value.

### Logic
```sql
SELECT 
    SUM(current_stock * purchase_price) as total_cost_value,
    SUM(current_stock * selling_price) as total_retail_value,
    (SUM(current_stock * selling_price) - SUM(current_stock * purchase_price)) as potential_margin
FROM products
WHERE current_stock > 0;
```

## 4. Stock > Régularisation (Adjustment)
**Objective**: Correcting stock levels explicitly.

### UX Flow
1.  **Search**: Reuse FTS5 product search.
2.  **Display**: Show `current_stock`.
3.  **Input**: User enters `real_quantity`.
4.  **Calculation**: `delta = real_quantity - current_stock`.
5.  **Commit**:
    ```sql
    BEGIN TRANSACTION;
    -- 1. Update Product
    UPDATE products SET current_stock = :real_quantity WHERE id = :id;
    
    -- 2. Log Movement
    INSERT INTO stock_movements (product_id, type, quantity, reason, created_at)
    VALUES (:id, 'ADJUSTMENT', :delta, :reason, datetime('now'));
    COMMIT;
    ```
