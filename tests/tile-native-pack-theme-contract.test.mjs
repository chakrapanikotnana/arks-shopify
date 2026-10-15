import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PDP submits calculated packs as Shopify quantity for every configured tile product', async () => {
  const [calculator, calculatorCore, selector, buyButtons, productForm] = await Promise.all([
    read('assets/tile-area-calculator.js'),
    read('assets/tile-area-calculator-core.js'),
    read('snippets/quantity-selector.liquid'),
    read('blocks/buy-buttons.liquid'),
    read('assets/product-form.js'),
  ]);

  assert.match(calculator, /quantity\.value = quantityValue/);
  assert.doesNotMatch(calculator, /orderingModel|pack-v1|tile_ordering_model/);
  assert.match(calculator, /createTileCalculatorState\(this\.dataset, input\.value\)/);
  assert.match(calculatorCore, /coverageM2: dataset\.packCoverageM2/);
  assert.match(calculatorCore, /packPriceMinor: dataset\.packPriceMinor/);
  assert.match(calculatorCore, /availablePacks: dataset\.availablePacks/);
  assert.match(calculatorCore, /reservedPacks: dataset\.reservedPacks/);
  assert.match(calculator, /addEventListener\('shopify:product:select', this\.#handleVariantChange/);
  assert.match(calculator, /syncTileCalculatorDataAttributes\(this, next\)/);
  assert.match(calculator, /next\.closest\('form'\)\?\.querySelector\('button\[ref="addToCartButton"\]'\)/);
  assert.match(selector, /name="quantity" value="1" data-tile-order-quantity/);
  assert.doesNotMatch(selector, /name="properties\[/);
  assert.doesNotMatch(calculator, /randomUUID|Date\.now|data-tile-order-property|createTileLineProperties/);
  assert.match(productForm, /const formData = new FormData\(form\)/);
  assert.match(productForm, /formData\.get\('id'\)/);
  assert.match(productForm, /formData\.get\('quantity'\)/);
  assert.doesNotMatch(productForm, /formData\.delete\(['"](?:properties|selling_plan)/);
  assert.match(selector, /data-pack-price-minor="\{\{ variant\.price \}\}"/);
  assert.match(selector, /data-pack-coverage-m2="\{\{ calculator_pack_coverage_m2 \}\}"/);
  assert.match(selector, /data-tiles-per-box="\{\{ calculator_tiles_per_box \}\}"/);
  assert.match(selector, /data-tiles-per-m2="\{\{ calculator_tiles_per_m2 \}\}"/);
  assert.match(selector, /<dt>Your Total<\/dt>/);
  assert.match(selector, /data-available-packs="\{\{ variant\.inventory_quantity \}\}"/);
  assert.match(selector, /data-reserved-packs="\{\{ cart \| item_count_for_variant: variant\.id \}\}"/);
  assert.match(calculator, /Calculation unavailable: tile pack details are missing or invalid\./);
  assert.doesNotMatch(calculator, /calculatePackPriceMinor/);
  assert.match(
    buyButtons,
    /product\.metafields\.arks\.tiles_per_box\.value > 0 and product\.metafields\.arks\.tiles_per_m2\.value > 0 and product\.metafields\.arks\.price_per_m2\.value > 0/
  );
  assert.doesNotMatch(`${calculator}\n${selector}\n${buyButtons}`, /tile_ordering_model|bundle-v1|pack-v1/);
});

test('PDP keeps square-metre display pricing separate from native pack pricing', async () => {
  const [price, inventory, priceBlock, productPriceScript, productInventoryScript] = await Promise.all([
    read('snippets/price.liquid'),
    read('blocks/product-inventory.liquid'),
    read('blocks/price.liquid'),
    read('assets/product-price.js'),
    read('assets/product-inventory.js'),
  ]);

  assert.match(price, /product_resource\.metafields\.arks\.price_per_m2\.value/);
  assert.match(price, /product_resource\.metafields\.arks\.compare_price_per_m2\.value/);
  assert.match(price, /assign native_price = selected_variant\.price/);
  assert.match(price, /assign native_compare_at_price = selected_variant\.compare_at_price/);
  assert.match(price, /{% if uses_public_m2_price %}\s*<div class="pdp-price__column">/);
  assert.match(price, /Price per m²/);
  assert.match(price, /Price per pack/);
  assert.match(price, /if uses_public_m2_price and compare_price_per_m2 > price_per_m2/);
  assert.match(price, /if native_compare_at_price > native_price/);
  assert.match(inventory, /closest\.product\.metafields\.arks\.price_per_m2\.value > 0/);
  assert.match(inventory, /Available packs: \{\{ inventory_quantity \}\}/);
  assert.match(priceBlock, /@media screen and \(max-width: 479px\)/);
  assert.match(productPriceScript, /StandardEvents\.productSelect/);
  assert.match(productPriceScript, /priceContainer\.replaceWith\(newPrice\)/);
  assert.match(productInventoryScript, /StandardEvents\.productSelect/);
  assert.match(productInventoryScript, /morph\(this, newInventory, \{ childrenOnly: true \}\)/);
});

test('homepage and collection cards use direct product-owned decimal square-metre prices', async () => {
  const [price, priceBlock, cardBlock, metafieldDefinitions] = await Promise.all([
    read('snippets/price.liquid'),
    read('blocks/price.liquid'),
    read('blocks/_product-card.liquid'),
    read('admin/arks5393-native-pack/01-create-metafield-definitions.graphql'),
  ]);

  assert.match(metafieldDefinitions, /key: "price_per_m2"[\s\S]*?type: "number_decimal"[\s\S]*?ownerType: PRODUCT/);
  assert.match(metafieldDefinitions, /key: "compare_price_per_m2"[\s\S]*?type: "number_decimal"[\s\S]*?ownerType: PRODUCT/);
  assert.match(price, /assign card_price_per_m2 = product_resource\.metafields\.arks\.price_per_m2\.value \| times: 100 \| round/);
  assert.match(price, /assign card_compare_price_per_m2 = product_resource\.metafields\.arks\.compare_price_per_m2\.value \| times: 100 \| round/);
  assert.doesNotMatch(price, /assign card_price_per_m2 = native_price \| divided_by/);
  assert.match(price, /assign native_price = selected_variant\.price/);
  assert.match(price, /assign native_compare_at_price = selected_variant\.compare_at_price/);
  assert.match(price, /if card_compare_price_per_m2 > card_price_per_m2/);
  assert.match(price, /if native_compare_at_price > native_price/);
  assert.match(price, /show_product_card_dual_price == false/);
  assert.match(priceBlock, /block_settings\.show_product_card_unit_prices \| default: false/);
  assert.match(priceBlock, /show_product_card_unit_prices: show_product_card_unit_prices/);
  assert.doesNotMatch(cardBlock, /show_product_card_unit_prices/);
});

test('homepage and collection use the same card block without opting in search or recommendations', async () => {
  const [homepageSection, collectionSection, searchSection, recommendations] = await Promise.all([
    read('sections/product-list.liquid'),
    read('sections/main-collection.liquid'),
    read('sections/search-results.liquid'),
    read('sections/product-recommendations.liquid'),
  ]);

  for (const surface of [homepageSection, collectionSection]) {
    assert.match(surface, /type: '_product-card'/);
    assert.match(surface, /product_view_context: 'collection'/);
  }
  assert.match(searchSection, /product_view_context: 'search'/);
  assert.match(recommendations, /product_view_context: 'recommendation'/);
});

test('homepage and collection card geometry keeps one-line titles and two fixed price rows', async () => {
  const [
    price,
    priceBlock,
    cardStyles,
    resourceStyles,
    carousel,
    productGrid,
    homepage,
    collection,
    cardMarkup,
  ] = await Promise.all([
    read('snippets/price.liquid'),
    read('blocks/price.liquid'),
    read('snippets/product-card-styles.liquid'),
    read('snippets/resource-list-styles.liquid'),
    read('snippets/resource-list-carousel.liquid'),
    read('snippets/product-grid.liquid'),
    read('templates/index.json'),
    read('templates/collection.json'),
    read('snippets/product-card.liquid'),
  ]);

  for (const template of [homepage, collection]) {
    assert.match(template, /"image_ratio": "square"/);
    assert.match(template, /"show_product_card_unit_prices": true/);
  }

  assert.match(homepage, /"columns_gap": 12/);
  assert.match(collection, /"columns_gap_horizontal": 12/);
  assert.match(cardMarkup, /data-card-context="\{\{ product_view_context \| escape \}\}"/);
  assert.match(cardStyles, /white-space: nowrap/);
  assert.match(cardStyles, /text-overflow: ellipsis/);
  assert.match(cardStyles, /min-block-size: 2\.75rem/);
  assert.match(resourceStyles, /--consistent-product-columns: 1/);
  assert.match(resourceStyles, /--consistent-product-columns: 3/);
  assert.match(resourceStyles, /--consistent-product-columns: 4/);
  assert.match(productGrid, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(productGrid, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(carousel, /var\(--consistent-product-columns\)/);
  assert.match(price, /product-card-price__row--primary/);
  assert.match(price, /product-card-price__row--secondary/);
  assert.match(price, /product-card-price__compare-placeholder/);
  assert.match(priceBlock, /white-space: nowrap/);
});

test('cart quantity and coverage stay Shopify-authoritative', async () => {
  const [cartItems, cartLiquid, cartDrawer, cartBlock] = await Promise.all([
    read('assets/component-cart-items.js'),
    read('snippets/cart-products.liquid'),
    read('snippets/cart-drawer.liquid'),
    read('blocks/_cart-products.liquid'),
  ]);

  assert.doesNotMatch(cartItems, /properties: config\.properties|tile-area:update/);
  assert.match(cartLiquid, /item\.product\.metafields\.arks\.tiles_per_box\.value \| divided_by: item\.product\.metafields\.arks\.tiles_per_m2\.value \| round: 2/);
  assert.match(cartLiquid, /<dt>Packs:<\/dt>\s*<dd>\{\{ item\.quantity \}\} \(\{\{ formatted_supplied_m2 \| strip \}\} m²\)<\/dd>/);
  assert.match(cartLiquid, /assign supplied_m2 = item\.quantity \| times: pack_coverage_m2 \| round: 2/);
  assert.match(cartLiquid, /if is_tile_product %\}Packs/);
  assert.doesNotMatch(cartLiquid, /tile-cart-area-editor/);
  assert.match(cartItems, /fetch\(`\$\{Theme\.routes\.cart_change_url\}`/);
  assert.match(cartItems, /morphSection\(this\.sectionId, parsedResponseText\.sections\[this\.sectionId\]/);
  assert.match(cartItems, /if \(quantity === 0\) \{\s*return this\.onLineItemRemove\(line\)/);
  assert.match(cartItems, /quantity: 0,\s*action: 'clear'/);
  assert.match(cartItems, /if \(parsedResponseText\.errors\) \{\s*this\.#handleCartError/);
  assert.match(cartDrawer, /render 'cart-products', context: 'drawer'/);
  assert.match(cartBlock, /render 'cart-products'/);
  assert.doesNotMatch(cartLiquid, /<dt>Supplied area:<\/dt>/);
  assert.match(cartLiquid, /if item\.unit_price_measurement and is_tile_product == false/);
  assert.equal(cartLiquid.match(/\{\{ public_price_per_m2 \| money \}\}\/m²/g)?.length, 1);
  assert.match(cartLiquid, /item\.final_line_price/);
  const cartSummary = await read('snippets/cart-summary.liquid');
  assert.match(cartSummary, /cart\.items_subtotal_price/);
  assert.match(cartSummary, /cart\.total_price/);
  assert.match(cartLiquid, /item\.quantity \| times: pack_coverage_m2/);
  assert.match(cartLiquid, /item\.product\.metafields\.arks\.price_per_m2/);
  assert.doesNotMatch(`${cartItems}\n${cartLiquid}`, /bundle-v1/);
});

test('non-tile products retain the standard quantity selector', async () => {
  const [selector, cartLiquid] = await Promise.all([
    read('snippets/quantity-selector.liquid'),
    read('snippets/cart-products.liquid'),
  ]);

  assert.match(selector, /<\{\{ component_name \}\}/);
  assert.match(cartLiquid, /{% render 'quantity-selector',/);
});

test('tile detection is product-data driven and missing configuration keeps the standard path', async () => {
  const [selector, buyButtons, inventory] = await Promise.all([
    read('snippets/quantity-selector.liquid'),
    read('blocks/buy-buttons.liquid'),
    read('blocks/product-inventory.liquid'),
  ]);

  assert.match(
    selector,
    /if line_index == null and is_tile_product/
  );
  assert.match(
    buyButtons,
    /product\.metafields\.arks\.price_per_m2\.value > 0/
  );
  assert.doesNotMatch(`${selector}\n${buyButtons}\n${inventory}`, /tile_ordering_model|pack-v1/);
  assert.match(inventory, /if is_tile_product/);
  assert.doesNotMatch(inventory, /inventory_quantity \| times:/);
  assert.match(inventory, /Available packs: \{\{ inventory_quantity \}\}/);
});

test('sticky and quick-add tile paths submit through the PDP calculator form', async () => {
  const [quickAdd, productCard, productSection, stickyScript] = await Promise.all([
    read('snippets/quick-add.liquid'),
    read('snippets/product-card.liquid'),
    read('sections/product-information.liquid'),
    read('assets/sticky-add-to-cart.js'),
  ]);

  assert.match(
    quickAdd,
    /if is_tile_product\s+assign initial_button = 'choose'\s+assign render_add = false\s+assign render_choose = true/
  );
  assert.doesNotMatch(productCard, /tile_ordering_model/);
  assert.match(productSection, /if section\.settings\.enable_sticky_add_to_cart/);
  assert.doesNotMatch(productSection, /enable_sticky_add_to_cart and tile_calculator_active == false/);
  assert.match(stickyScript, /this\.#targetAddToCartButton\.click\(\)/);
});
