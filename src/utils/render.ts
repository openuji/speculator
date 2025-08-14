export function insertContent(element: Element, content: string): void {
  element.innerHTML = content;
}

export function renderError(element: Element, message: string): void {
  element.innerHTML = `<p class="error">${message}</p>`;
}
