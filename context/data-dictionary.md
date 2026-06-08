# Data dictionary

Plain-English guide to the two spreadsheets in `data/`. Read this before loading anything — the sheets are how the team actually keeps them, which means **each sheet holds more than one table stacked on top of each other**, separated by a blank row and a bold banner label. Don't assume the first row is the only header.

## sales.xlsx — sheet "Sales Data"

Two tables, stacked top to bottom.

### Table 1: ORDERS
One row **per line item**, not per order — so `order_id` repeats when an order has more than one product.

| column | meaning |
|--------|---------|
| `order_id` | Order identifier (e.g. `NW-10001`). Repeats across the order's line items. |
| `order_date` | Date the order was placed. |
| `channel` | Where it came from: `Northwind Web` or `Amazon`. |
| `order_type` | `Subscription` or `One-time`. Subscriptions only happen on Northwind Web. |
| `region` | US region the order shipped to. |
| `sku` | Product code (joins to inventory). |
| `product` | Human-readable product name + size. |
| `qty` | Units of this SKU on this line. |
| `unit_price` | List price per unit, before discount. |
| `discount_code` | Promo/subscription code applied, if any (blank = none). |
| `line_total` | **Net** revenue for the line — already has the discount taken out. |

Useful to know:
- **Net revenue** = sum of `line_total`. **Gross** = `qty × unit_price`. **Discount** = gross − `line_total`.
- **AOV** (average order value) = net revenue ÷ number of distinct `order_id`s.
- **Subscription mix** = share of revenue (or of orders) where `order_type = Subscription`.

### Table 2: RETURNS
Refunds processed during the period. `order_id` joins back to the ORDERS table.

| column | meaning |
|--------|---------|
| `return_id` | Return identifier (e.g. `NW-R-5001`). |
| `order_id` | The original order this return belongs to. |
| `return_date` | Date the return was processed. |
| `sku` | Product returned. |
| `product` | Product name + size. |
| `qty` | Units returned. |
| `refund_amount` | Dollar amount refunded. |
| `reason` | Free-text return reason. |

- **Return rate** = returned units ÷ units sold. The team wants this **broken out by size (12oz vs 2lb)** — the size is in the `product` name.

## inventory.xlsx — sheet "Inventory"

Two tables, stacked top to bottom.

### Table 1: ON HAND
Stock snapshot as of the `last_counted` date — one row per SKU.

| column | meaning |
|--------|---------|
| `sku` | Product code (joins to sales). |
| `product` | Product name. |
| `roast` | Roast level (`-` for non-coffee). |
| `size` | Pack size (`-` for merch). |
| `on_hand_units` | Units currently in stock. |
| `reorder_point` | When on-hand drops below this, it's time to reorder. |
| `safety_stock` | Buffer we try not to dip below. |
| `avg_weekly_units_4wk` | Average units sold per week over the last 4 weeks (sales velocity). |
| `warehouse` | Where the stock sits. |
| `last_counted` | Date of this snapshot. |

- **Weeks of cover** = `on_hand_units ÷ avg_weekly_units_4wk`. Watch for divide-by-zero on slow movers where velocity is 0.
- **Stockout risk** = `on_hand_units` below `reorder_point`, or under ~2 weeks of cover.
- **Sell-through** compares how fast a SKU moves against what we hold — join velocity (sales) to on-hand (inventory).

### Table 2: INBOUND PURCHASE ORDERS
Open and recently received POs — what's coming and when.

| column | meaning |
|--------|---------|
| `po_number` | PO identifier (e.g. `NW-PO-1042`). |
| `sku` | Product on order. |
| `product` | Product name. |
| `supplier` | Who we ordered from. |
| `qty_ordered` | Units on the PO. |
| `order_date` | When we placed the PO. |
| `expected_arrival` | When it's due to land. |
| `status` | `Ordered`, `In transit`, or `Received`. |

A SKU with low weeks-of-cover **and** no inbound PO is the real fire drill.
