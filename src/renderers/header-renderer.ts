export class HeaderRenderer {
  render(header?: Element): { header?: Element } {
    const result: { header?: Element } = {};
    if (header) result.header = header;
    return result;
  }
}
