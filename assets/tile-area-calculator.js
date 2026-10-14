import { formatMoney } from '@theme/money-formatting';
import {
  calculateTileOrder,
  formatArea,
  resolveCoverage,
} from './tile-area-calculator-core.js';

class TileAreaCalculator extends HTMLElement {
  #abortController = new AbortController();
  #variantCanAddToCart = false;

  connectedCallback() {
    this.#abortController = new AbortController();
    const addToCartButton = this.#getAddToCartButton();
    this.#variantCanAddToCart = addToCartButton?.disabled === false;
    this.querySelector('[data-calculator-area-input]')?.addEventListener('input', this.#render, {
      signal: this.#abortController.signal,
    });
    this.closest('.shopify-section, dialog')?.addEventListener('shopify:product:select', this.#handleVariantChange, {
      signal: this.#abortController.signal,
    });
    this.#render();
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }

  #handleVariantChange = (event) => {
    const promise = event?.promise;
    if (!promise) return;

    promise.then(({ detail }) => {
      const next = detail?.html?.querySelector(`tile-area-calculator[data-product-id="${this.dataset.productId}"]`);
      if (!next) return;

      const nextAddToCartButton = detail.html.querySelector('button[ref="addToCartButton"]');
      this.#variantCanAddToCart = nextAddToCartButton?.disabled === false;

      for (const attribute of next.attributes) {
        if (attribute.name.startsWith('data-')) this.setAttribute(attribute.name, attribute.value);
      }
      this.#render();
    }).catch((error) => {
      if (error?.name !== 'AbortError') console.warn('[tile-area-calculator] Variant update failed:', error);
    });
  };

  #render = () => {
    const input = this.querySelector('[data-calculator-area-input]');
    const error = this.querySelector('[data-calculator-error]');
    const packs = this.querySelector('[data-calculator-packs]');
    const total = this.querySelector('[data-calculator-total]');
    if (!input || !error || !packs || !total) return;

    const continueSelling = this.dataset.continueSelling === 'true';
    const coverage = resolveCoverage({
      tilesPerBox: this.dataset.tilesPerBox,
      tilesPerM2: this.dataset.tilesPerM2,
    });
    const coverageM2 = coverage ? formatArea(coverage.numerator, coverage.denominator) : '';
    const result = calculateTileOrder({
      requestedM2: input.value,
      coverageM2,
      packPriceMinor: this.dataset.packPriceMinor,
      availablePacks: this.dataset.availablePacks,
      reservedPacks: this.dataset.reservedPacks,
      continueSelling,
    });

    if (!result.valid || result.insufficientStock) {
      let message = !coverage
        ? 'Calculation unavailable: tile pack details are missing or invalid.'
        : result.error ?? '';
      if (result.insufficientStock) message = 'The required packs exceed the currently available stock.';
      error.textContent = message;
      error.hidden = false;
    } else {
      error.textContent = '';
      error.hidden = true;
    }

    const calculatedPacks = result.valid && !result.insufficientStock ? result.packs : null;
    this.#writeOrderQuantity(calculatedPacks);
    this.#setAddToCartDisabled(calculatedPacks === null || !this.#variantCanAddToCart);

    packs.textContent = result.valid ? `${result.packs} (${result.suppliedM2} m²)` : '—';
    const moneyFormat = (this.dataset.moneyFormat ?? '£{{amount}}').replace(
      /{{\s*amount(?:_[a-z_]+)?\s*}}/,
      '{{amount}}'
    );
    total.textContent = result.valid
      ? formatMoney(result.totalMinor, moneyFormat, this.dataset.currency ?? 'GBP')
      : '—';
  };

  #writeOrderQuantity(packs) {
    const quantity = this.querySelector('input[data-tile-order-quantity]');
    if (quantity instanceof HTMLInputElement) quantity.value = packs === null ? '1' : String(packs);
  }

  #getAddToCartButton() {
    const button = this.closest('form')?.querySelector('button[ref="addToCartButton"]');
    return button instanceof HTMLButtonElement ? button : null;
  }

  #setAddToCartDisabled(disabled) {
    const button = this.#getAddToCartButton();
    if (!button) return;

    const disabledByCalculator = button.dataset.tileCalculatorDisabled === 'true';
    if (disabled) {
      button.disabled = true;
      button.dataset.tileCalculatorDisabled = 'true';
    } else if (disabledByCalculator) {
      button.disabled = !this.#variantCanAddToCart;
      delete button.dataset.tileCalculatorDisabled;
    }
  }
}

if (!customElements.get('tile-area-calculator')) {
  customElements.define('tile-area-calculator', TileAreaCalculator);
}
