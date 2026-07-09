// Hand-drawn donghua/anime wallet + stamina chip icons used by PlayerHeader
// in place of the flat Ionicons. Keyed by the logical chip name.
import type { ImageSourcePropType } from 'react-native';

export const UI_ICONS: Record<string, ImageSourcePropType> = {
  stamina: require('../../assets/ui-icons/icon_stamina.png'),
  crowns: require('../../assets/ui-icons/icon_crowns.png'),
  refined_gem: require('../../assets/ui-icons/icon_refined_gem.png'),
  lotus_gem: require('../../assets/ui-icons/icon_lotus_gem.png'),
  university_credit: require('../../assets/ui-icons/icon_university_credit.png'),
};

export function getUiIcon(name: keyof typeof UI_ICONS): ImageSourcePropType {
  return UI_ICONS[name];
}
