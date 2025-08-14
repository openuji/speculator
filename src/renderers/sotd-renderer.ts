export class SotdRenderer {
  render(sotd?: Element): { sotd?: Element } {
    const result: { sotd?: Element } = {};
    if (sotd) result.sotd = sotd;
    return result;
  }
}
