// Hand-drawn donghua/anime portrait avatars the player can choose from.
// `avatar_id` on PlayerState stores one of these ids; an empty/unknown id
// falls back to the aptitude Ionicon in PlayerHeader/Profile.
import type { ImageSourcePropType } from 'react-native';

export type AvatarOption = {
  id: string;
  label: string;
  source: ImageSourcePropType;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: 'portrait_01', label: 'Lotus Matron', source: require('../../assets/avatars/portrait_01.png') },
  { id: 'portrait_02', label: 'Resolute Medic', source: require('../../assets/avatars/portrait_02.png') },
  { id: 'portrait_03', label: 'Elder Mentor', source: require('../../assets/avatars/portrait_03.png') },
  { id: 'portrait_04', label: 'Bright Apprentice', source: require('../../assets/avatars/portrait_04.png') },
  { id: 'portrait_05', label: 'Guardian Healer', source: require('../../assets/avatars/portrait_05.png') },
  { id: 'portrait_06', label: 'Mystic Lotus', source: require('../../assets/avatars/portrait_06.png') },
];

const AVATAR_MAP: Record<string, AvatarOption> = AVATAR_OPTIONS.reduce(
  (acc, o) => { acc[o.id] = o; return acc; },
  {} as Record<string, AvatarOption>,
);

export function getAvatarSource(id?: string | null): ImageSourcePropType | null {
  if (!id) return null;
  return AVATAR_MAP[id]?.source ?? null;
}

// '' clears back to the aptitude icon; any other value must be a known option.
export function isValidAvatarId(id: string): boolean {
  return id === "" || !!AVATAR_MAP[id];
}
