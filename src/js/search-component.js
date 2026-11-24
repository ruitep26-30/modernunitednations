/**
 * Modern United Nations - Search Component (<cir-search>)
 * Reusable pill search component with auto-focus handling.
 */

const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class CirSearchComponent extends BaseElement {
  connectedCallback() {
    if (!this.querySelector('.cir-search')) {
      const placeholder = this.getAttribute('placeholder') || 'Search...';
      const inputId = this.getAttribute('input-id') || 'searchInput';

      this.innerHTML = `
        <label class="cir-search" for="${inputId}">
          <svg
            class="cir-search__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.34-4.34"></path>
          </svg>
          <input
            class="cir-search__field"
            id="${inputId}"
            type="search"
            placeholder="${placeholder}"
            aria-label="Search"
            autocomplete="off"
          />
        </label>
      `;
    }
  }

  get input() {
    return this.querySelector('.cir-search__field');
  }

  get value() {
    return this.input ? this.input.value : '';
  }

  set value(val) {
    if (this.input) {
      this.input.value = val;
      this.input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('cir-search')) {
  customElements.define('cir-search', CirSearchComponent);
}
