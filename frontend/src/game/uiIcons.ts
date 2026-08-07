// Hand-drawn donghua/anime wallet + stamina chip icons used by PlayerHeader
// in place of the flat Ionicons. Keyed by the logical chip name.
// Push 3: stamina + crowns updated to the painted hub-emblems.
import type { ImageSourcePropType } from 'react-native';

export const UI_ICONS: Record<string, ImageSourcePropType> = {
  stamina:            require('../../assets/ui-icons/hub/stamina-emblem.png'),
  crowns:             require('../../assets/ui-icons/hub/currency-emblem.png'),
  refined_gem:        require('../../assets/ui-icons/icon_refined_gem.png'),
  lotus_gem:          require('../../assets/ui-icons/icon_lotus_gem.png'),
  university_credit:  require('../../assets/ui-icons/icon_university_credit.png'),
};

export function getUiIcon(name: keyof typeof UI_ICONS): ImageSourcePropType {
  return UI_ICONS[name];
}

// Class medallion PNGs — one per ClassId.  Falls back to undefined so callers
// can degrade to an Ionicons glyph when no emblem asset is available yet.
export const CLASS_EMBLEMS: Partial<Record<string, ImageSourcePropType>> = {
  medic:      require('../../assets/ui-icons/hub/medic-emblem.png'),
  guardian:   require('../../assets/ui-icons/hub/guardian-emblem.png'),
  seer:       require('../../assets/ui-icons/hub/seer-emblem.png'),
  caretaker:  require('../../assets/ui-icons/hub/caretaker-emblem.png'),
  scholar:    require('../../assets/ui-icons/hub/scholar-emblem.png'),
  alchemist:  require('../../assets/ui-icons/hub/alchemist-emblem.png'),
};

export function getClassEmblem(classId: string): ImageSourcePropType | undefined {
  return CLASS_EMBLEMS[classId];
}
