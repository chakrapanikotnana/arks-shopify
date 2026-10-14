# Native pack tile ordering

## Status

The theme implements native pack ordering for a product when all three
product-owned activation values are positive:

```text
arks.tiles_per_box
arks.tiles_per_m2
arks.price_per_m2
```

Do not complete those activation values until every sellable variant's native
Shopify price, compare-at price, and inventory have been reviewed as pack
units. Missing, zero, or invalid activation values retain the standard product
quantity experience. `arks.tile_ordering_model` is no longer read by the theme.

The earlier Cart Transform/bundle source remains in `tile-ordering-backend/`
for history and is not referenced by this ordering path. No Function,
component variant, `requiresComponents` setting, or availability synchronizer
is needed for native pack ordering.

## Units

For ARKS5393:

- customer-facing price: **£19.49/m²**;
- customer-facing compare-at price: **£38.98/m²**;
- required area input: positive whole square metres;
- Shopify sellable unit and cart quantity: **one complete pack**;
- coverage: **1.44 m² per pack**;
- Shopify pack price: **£28.07**;
- Shopify pack compare-at price: **£56.13**;
- Shopify pack inventory: **102**;
- orderable availability: `102 × 1.44 = 146.88 m²`;
- non-sellable physical remainder: **0.12 m²**.

The public square-metre prices are stored separately from the Shopify variant
price. The theme never reads the unrelated `arks.price` value.

## Calculation and authority

```text
packs = ceil(requiredArea / coveragePerPack)
suppliedArea = packs × coveragePerPack
total = packs × Shopify pack price
```

Shopify is authoritative for both the charge and stock deduction because the
submitted quantity is the number of complete packs. No calculator line-item
properties are submitted, so repeated additions of the same variant merge
naturally.

| Required | Shopify quantity | Supplied | Actual line total |
|---:|---:|---:|---:|
| 1 m² | 1 pack | 1.44 m² | £28.07 |
| 6 m² | 5 packs | 7.20 m² | £140.35 |

The five-pack total intentionally uses per-pack currency rounding:
`5 × £28.07 = £140.35`.

## Theme behavior

- PDP keeps the compact area calculator and displays £19.49/m².
- The hidden Shopify `quantity` input is the calculated pack count.
- Add to cart remains disabled when coverage or requested area is invalid, or
  when the required packs exceed native inventory.
- Cart drawer and cart page derive packs and supplied area from Shopify's
  actual line quantity and show Shopify's `final_line_price`.
- Cart quantity edits call `/cart/change.js` with native pack quantity and
  preserve unrelated line properties.
- Removal, discounts, variant behavior, and non-tile quantity controls remain
  native.
- Availability is calculated directly as tracked pack inventory × coverage;
  the 0.12 m² remainder is recorded but is not shown as orderable stock.

## Custom data

Create definitions before setting values:

| Owner | Namespace/key | Type | ARKS5393 value |
|---|---|---|---:|
| Product | `arks.price_per_m2` | `number_decimal` | `19.49` |
| Product | `arks.compare_price_per_m2` | `number_decimal` | `38.98` |
| Product | `arks.tiles_per_box` | `number_integer` (positive) | `4` |
| Product | `arks.tiles_per_m2` | `number_decimal` (positive) | `2.78` |

`arks.compare_price_per_m2` is optional when there is no public compare-at
price. `arks.pack_coverage_m2`, `arks.non_sellable_remainder_m2`, and the old
variant `arks.tile_ordering_model` can remain as audit data but are not used by
the storefront.

The current loose `arks.compare_price_per_m2=38.98` value is preserved and
given a definition. `arks.price_per_m2` is new; `arks.price=32.58` remains
untouched and unused.

## ARKS5393 review package

Exact, schema-validated Admin API 2026-10 operations are in
`admin/arks5393-native-pack/`. Apply them only after reviewing the current
inventory again. The inventory operation uses compare-and-set and will fail
instead of overwriting stock if on-hand inventory is no longer 147.

The historical ARKS5393 conversion was deliberately staged:

1. Create metafield definitions.
2. Write the four product display/configuration values.
3. Change the variant price and compare-at price to pack values.
4. Change on-hand inventory from 147 to 102 with compare-and-set.
5. Read back and verify all values.
6. Only then activate the required positive tile metafields.

No operation changes `requiresComponents`; it must remain `false`.
