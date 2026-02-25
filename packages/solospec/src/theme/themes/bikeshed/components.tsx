import type { ThemeSlots } from '#src/theme/types';
import { baseSlots } from '#src/theme/themes/base/components';

function BikeshedHeader(props: Parameters<ThemeSlots['Header']>[0]) {
  const { vm } = props;

  return (
    <header class="spec-header spec-header--bikeshed">
      {baseSlots.Header({ vm })}
    </header>
  );
}

export const bikeshedSlots: ThemeSlots = {
  ...baseSlots,
  Header: BikeshedHeader,
};
