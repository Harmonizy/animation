type Attributes = Record<string, string>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

export function select(
  id: string,
  options: readonly (readonly [value: string, label: string])[],
  value: string,
  label: string,
): HTMLSelectElement {
  const element = el(
    'select',
    { id, 'aria-label': label },
    ...options.map(([optionValue, text]) => el('option', { value: optionValue }, text)),
  );
  element.value = value;
  return element;
}

export function panelSection(title: string, ...children: Node[]): HTMLElement {
  return el('section', { class: 'panel-section' }, el('h2', {}, title), ...children);
}
