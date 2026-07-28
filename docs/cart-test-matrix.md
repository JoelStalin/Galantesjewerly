# Cart and checkout test matrix

These rules are regression requirements for every storefront, Odoo, payment, or inventory change.

| Area | Required case | Expected result |
|---|---|---|
| Quantity | Empty cart | Checkout rejected without creating an order or payment intent |
| Quantity | Zero, negative, decimal, NaN, infinity | Rejected server-side |
| Quantity | Quantity exactly equal to stock | Accepted |
| Quantity | Quantity greater than stock | Rejected with available quantity |
| Quantity | Repeated product lines | Rejected or consolidated before checkout; never bypasses stock |
| Quantity | Numeric/string/tampered IDs | Valid IDs normalized; invalid IDs rejected |
| Stock | Stock changes after page load | Checkout re-reads Odoo and rejects stale cart |
| Stock | Stock reaches zero | Product cannot be purchased |
| Stock | Two buyers request the last unit | Only one order may reserve/confirm it |
| Stock | Product inactive/service/not website-visible | Checkout rejected |
| Price | Client sends a lower price | Server/Odoo price is used |
| Price | Client sends a higher price | Server/Odoo price is used |
| Product | Product deleted or unavailable | Checkout rejected without payment intent |
| Cart | Add same product repeatedly | Quantity is capped at stock |
| Cart | Update quantity above stock | Quantity is capped or rejected |
| Cart | Update quantity to zero | Line removed |
| Cart | Remove one line | Other lines remain unchanged |
| Cart | Clear cart | All lines and persisted state are removed |
| Persistence | Malformed localStorage | Cart resets safely; app remains usable |
| Persistence | Stale localStorage stock | Server validation wins at checkout |
| Checkout | Odoo unavailable | No Stripe intent is created; actionable error returned |
| Checkout | Stripe unavailable | Odoo order remains auditable and retry policy is applied |
| Checkout | Client retries same request | Idempotency prevents duplicate orders/charges |
| Checkout | Customer validation failure | No Odoo order or payment intent is created |
| Payment | Payment fails | Inventory/order state is not falsely marked paid |
| Payment | Payment succeeds | Order and inventory transition are consistent |
| Security | Price/quantity modified in DevTools | Server rejects or corrects the values |
| Security | Duplicate checkout request | No double charge or double reservation |
| Recovery | Browser refresh during checkout | Cart recovery does not exceed current stock |
| Recovery | Network timeout after submit | Retry is safe and status can be recovered |
| Regression | Product image/gallery changes | Cart identity and stock remain unchanged |

Functional production checks must use a designated test product/order and must not mutate customer data. Destructive inventory tests belong in staging or an explicitly approved disposable product.
