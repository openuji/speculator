export function insertContent(element: Element, content: string): void {
  element.innerHTML = content;
}

export function renderError(message: string): string {
  return `<p class="error">${message}</p>`;
}
