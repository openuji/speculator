declare module 'linkedom' {
  export class DOMParser {
    parseFromString(html: string, type: string): Document;
  }
}
