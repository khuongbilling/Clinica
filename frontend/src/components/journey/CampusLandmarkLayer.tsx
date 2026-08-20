/**
 * Runtime Chapter 1 campus landmarks.
 *
 * Blocking scenery belongs here, not in the background raster: the visual prop
 * and the map's excluded collision cells share the same landmark data.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import type { HexWorldCoords } from './hexWorldCoords';
import {
  CHAPTER_ONE_CAMPUS_LANDMARKS,
  chapterOneCampusLandmarkZ,
  type CampusLandmarkKind,
} from '../../game/journeyMap/chapterOneCampusLandmarks';

const LANDMARK_ASSETS: Record<CampusLandmarkKind, number> = {
  grandFountain: require('@/assets/map-props/campus-grand-fountain.png') as number,
  planterCypresses: require('@/assets/map-props/campus-planter-cypresses.png') as number,
};

export function CampusLandmarkLayer({
  chapterId,
  coords,
}: {
  chapterId: number;
  coords: HexWorldCoords | null;
}): React.ReactElement | null {
  if (chapterId !== 1 || coords == null) return null;

  return (
    <>
      {CHAPTER_ONE_CAMPUS_LANDMARKS.map(landmark => {
        const { cx, cy } = coords.axialToWorld(landmark.anchor.q, landmark.anchor.r);
        const width = Math.round(landmark.sizeTiles.w * coords.sz);
        const height = Math.round(landmark.sizeTiles.h * coords.sz);
        return (
          <View
            key={landmark.id}
            pointerEvents="none"
            style={[
              s.landmark,
              {
                left: cx - width / 2,
                top: cy - height * 0.84,
                width,
                height,
                zIndex: chapterOneCampusLandmarkZ(landmark.anchor.q, landmark.anchor.r),
              },
            ]}
          >
            <Image
              source={LANDMARK_ASSETS[landmark.kind]}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
              testID={`campus-landmark-${landmark.id}`}
            />
          </View>
        );
      })}
    </>
  );
}

const s = StyleSheet.create({
  landmark: {
    position: 'absolute',
  },
});