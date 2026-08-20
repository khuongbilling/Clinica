/**
 * stage3AssetSelector.ts
 *
 * Pure, testable Stage 3 approval gate. A raster can be rendered only if an
 * exact chapter:shift:hash registration agrees with a validated manifest.
 */

export interface Stage3ManifestIdentity {
  readonly chapterId: number;
  readonly shift: string;
  readonly mapBlueprintHash: string;
  readonly mapStructureHash: string;
  readonly mapLayoutVersion: string;
  readonly rasterAsset: string;
  readonly assetStatus: string;
  readonly assetVersion: string;
}

export interface BlueprintRasterRegistration<TSource = number> {
  readonly source: TSource;
  readonly assetPath: string;
}

export type Stage3SelectionStatus = 'APPROVED' | 'MISSING' | 'MISMATCHED';

export interface Stage3AssetSelection<TSource = number> {
  readonly status: Stage3SelectionStatus;
  readonly registryKey: string;
  /** Present only when the raster is approved for runtime reveal. */
  readonly source?: TSource;
  /** Present only when the raster is approved for runtime reveal. */
  readonly selectedAssetPath?: string;
  /** A rejected registry path, shown only for developer remediation. */
  readonly candidateAssetPath?: string;
  readonly reason: string;
}

export interface Stage3SelectionOptions {
  /**
   * Stage 3 is a reveal of a Stage 2-proven path. A failed path validation must
   * leave the permanent Stage 1 blueprint in place even if an old asset key
   * would otherwise match.
   */
  readonly stage2Pass?: boolean;
}

export function selectStage3Asset<TSource>(
  manifest: Stage3ManifestIdentity,
  registry: Readonly<Record<string, BlueprintRasterRegistration<TSource> | undefined>>,
  options: Stage3SelectionOptions = {},
): Stage3AssetSelection<TSource> {
  const registryKey = `${manifest.chapterId}:${manifest.shift}:${manifest.mapBlueprintHash}:${manifest.mapStructureHash}`;
  const registration = registry[registryKey];
  const expectedVersion =
    `${manifest.mapLayoutVersion}:${manifest.mapBlueprintHash}:${manifest.mapStructureHash}`;

  if (options.stage2Pass === false) {
    return {
      status: 'MISMATCHED',
      registryKey,
      candidateAssetPath: registration?.assetPath,
      reason: 'Stage 2 walkable-path validation failed; finished environment reveal is suppressed.',
    };
  }

  if (registration == null) {
    return {
      status: 'MISSING',
      registryKey,
      reason: 'No exact chapter, shift, and blueprint-hash registration exists.',
    };
  }

  if (manifest.assetStatus !== 'validated') {
    return {
      status: 'MISSING',
      registryKey,
      candidateAssetPath: registration.assetPath,
      reason: `Manifest status is ${manifest.assetStatus}; an approved raster is required.`,
    };
  }

  if (manifest.assetVersion !== expectedVersion || registration.assetPath !== manifest.rasterAsset) {
    return {
      status: 'MISMATCHED',
      registryKey,
      candidateAssetPath: registration.assetPath,
      reason: registration.assetPath !== manifest.rasterAsset
        ? 'Registered asset path does not match the manifest.'
        : 'Manifest asset version does not match the active blueprint hash.',
    };
  }

  return {
    status: 'APPROVED',
    registryKey,
    source: registration.source,
    selectedAssetPath: registration.assetPath,
    reason: 'Exact approved raster matches the active manifest and blueprint hash.',
  };
}
