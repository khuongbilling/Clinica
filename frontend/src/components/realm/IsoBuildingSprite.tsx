import { Image, ImageSourcePropType, Pressable, View } from "react-native";

// Renders a 2.5D building/decoration sprite anchored so its bottom edge sits
// exactly on the front-most corner of its footprint's ground diamond,
// horizontally centered — the standard billboard technique for sprites in a
// 2D isometric scene.
export function IsoBuildingSprite({
  source, centerX, bottomY, width, heightRatio = 1.02, opacity = 1, dim, onPress, testID, children,
}: {
  source: ImageSourcePropType;
  centerX: number;
  bottomY: number;
  width: number;
  heightRatio?: number;
  opacity?: number;
  dim?: string;
  onPress?: () => void;
  testID?: string;
  children?: React.ReactNode;
}) {
  const height = width * heightRatio;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        position: "absolute",
        left: centerX - width / 2,
        top: bottomY - height,
        width,
        height,
        opacity,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: height * 0.03,
          left: width * 0.12,
          width: width * 0.76,
          height: height * 0.1,
          borderRadius: 999,
          backgroundColor: "rgba(0,0,0,0.38)",
        }}
      />
      <Image source={source} style={{ width: "100%", height: "100%" }} resizeMode="contain" />
      {dim && <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: dim }} />}
      {children}
    </Pressable>
  );
}
