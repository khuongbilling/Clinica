import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { ITEMS } from "@/src/game/items";
import { SKINS, UPGRADES, WARD_BOOSTS, STAMINA_PACKS } from "@/src/game/shop";
import { regen, maxStaminaForPlayer } from "@/src/game/stamina";
import {
  WARD_UNIT_IDS, WARD_UNIT_META, GACHA_COST, MASTERY_LEVEL_CAP,
  UNIT_STAT_BLOCKS, getMasteryStats, getMasteryRequirement, unlockedMilestones,
  MERGE_RANK_NAMES,
} from "@/src/game/units";
import {
  CURRENCIES, WEEKLY_GEM_BUNDLES, MONTHLY_GEM_BUNDLES, GEM_BUNDLE_STATUS,
  SANCTUARY_BANK_EXCHANGE_TABLE, SANCTUARY_BANK_CAPS,
  SANCTUARY_BAZAAR_TRADEABLE, SANCTUARY_BAZAAR_NON_TRADEABLE, SANCTUARY_BAZAAR_STATUS,
  MONETIZATION_PRODUCTS, ECONOMY_ANCHORS,
} from "@/src/game/economy";
import { findShopSection, ShopGroupId } from "@/src/game/shopHub";

const GROUP_LABEL: Record<ShopGroupId, string> = {
  consumables: "Consumables",
  ward: "Ward Defense Boosts",
  refills: "Stamina Refills",
  recruit: "Recruit Healers",
  upgrades: "Permanent Upgrades",
  skins: "Cosmetic Regalia",
  premium: "Premium & Currencies",
};

export default function ShopSection() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const section = findShopSection(Array.isArray(id) ? id[0] : id);

  const { player, purchaseItem, purchaseSkin, equipSkin, purchaseUpgrade, refillStamina, pullGacha, upgradeUnitMastery, exchangeInsightCrystals } = usePlayer();
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [infoUnitId, setInfoUnitId] = useState<string | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bazaarOpen, setBazaarOpen] = useState(false);

  const crowns = player?.crowns || 0;
  const insightCrystals = player?.insight_crystals || 0;
  const refinedLotusGems = player?.refined_lotus_gems || 0;
  const lotusGemsPaid = player?.lotus_gems_paid || 0;

  const staminaMax = useMemo(() => maxStaminaForPlayer(player), [player]);
  const staminaNow = useMemo(() => {
    if (!player) return 0;
    const now = Date.now();
    return regen(player.stamina ?? staminaMax, player.stamina_updated_at ?? new Date(now).toISOString(), now, staminaMax).stamina;
  }, [player, staminaMax]);

  function flash(ok: boolean, msg: string) {
    setBanner({ ok, msg });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => setBanner(null), 2600);
  }

  if (!player) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  if (!section || !section.groups) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={["top", "bottom"]}>
        <Text style={styles.empty}>This market stall isn't available.</Text>
        <Pressable style={styles.equipBtn} onPress={() => goBack(router, "/(tabs)/shop")} testID="shop-section-back-empty">
          <Text style={styles.equipBtnTxt}>Back to Market</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const groups = section.groups;
  const multi = groups.length > 1;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <PlayerHeader player={player} />
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => goBack(router, "/(tabs)/shop")}
          hitSlop={10}
          style={styles.backBtn}
          testID="shop-section-back"
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{section.title}</Text>
          <Text style={styles.subtitle}>{section.subtitle}</Text>
        </View>
        <Pressable
          onPress={() => router.push("/economy")}
          hitSlop={10}
          style={styles.infoBtn}
          testID="shop-economy-guide"
        >
          <Ionicons name="help-circle-outline" size={22} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      </View>

      {banner && (
        <View style={[styles.banner, { borderColor: banner.ok ? COLORS.success : COLORS.error }]}>
          <Ionicons name={banner.ok ? "checkmark-circle" : "alert-circle"} size={16} color={banner.ok ? COLORS.success : COLORS.error} />
          <Text style={[styles.bannerTxt, { color: banner.ok ? COLORS.success : COLORS.error }]}>{banner.msg}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups.map((g) => (
          <View key={g} style={{ gap: SPACING.md }}>
            {multi && <Text style={styles.groupHeading}>{GROUP_LABEL[g]}</Text>}

            {g === "consumables" && (
              <>
                <Text style={styles.blurb}>Battle items are added to your inventory and used during encounters.</Text>
                {ITEMS.map((it) => {
                  const owned = player.inventory?.[it.name] || 0;
                  const afford = crowns >= it.price;
                  return (
                    <View key={it.id} style={styles.card} testID={`shop-item-${it.id}`}>
                      <View style={styles.cardMain}>
                        <View style={styles.cardHead}>
                          <Text style={styles.cardName}>{it.displayName}</Text>
                          {owned > 0 && <Text style={styles.ownedTag}>×{owned}</Text>}
                        </View>
                        <Text style={styles.cardSub}>{it.rpgSubtitle}</Text>
                        <Text style={styles.cardEffect}>{it.shortEffect}</Text>
                        <Text style={styles.cardDesc}>{it.beginnerExplanation}</Text>
                      </View>
                      <BuyButton
                        price={it.price}
                        disabled={!afford}
                        onPress={async () => { const r = await purchaseItem(it.name, it.price); flash(r.ok, r.message); }}
                        testID={`shop-buy-${it.id}`}
                      />
                    </View>
                  );
                })}
              </>
            )}

            {g === "ward" && (
              <>
                <Text style={styles.blurb}>Ward Defense boosts sit in your inventory. Activate them in the Ward Defense lobby before a run — each is consumed on use.</Text>
                {WARD_BOOSTS.map((w) => {
                  const owned = player.inventory?.[w.name] || 0;
                  const afford = crowns >= w.price;
                  return (
                    <View key={w.id} style={styles.card} testID={`shop-ward-${w.id}`}>
                      <View style={[styles.iconBadge, { borderColor: COLORS.river }]}>
                        <Ionicons name={w.icon as any} size={20} color={COLORS.river} />
                      </View>
                      <View style={styles.cardMain}>
                        <View style={styles.cardHead}>
                          <Text style={styles.cardName}>{w.name}</Text>
                          {owned > 0 && <Text style={styles.ownedTag}>×{owned}</Text>}
                        </View>
                        <Text style={styles.cardEffect}>{w.subtitle}</Text>
                        <Text style={styles.cardDesc}>{w.description}</Text>
                      </View>
                      <BuyButton
                        price={w.price}
                        disabled={!afford}
                        onPress={async () => { const r = await purchaseItem(w.name, w.price); flash(r.ok, r.message); }}
                        testID={`shop-buy-${w.id}`}
                      />
                    </View>
                  );
                })}
              </>
            )}

            {g === "refills" && (
              <>
                <View style={styles.staminaCard}>
                  <Ionicons name="flash" size={18} color={COLORS.energy} />
                  <Text style={styles.staminaTxt}>Stamina {staminaNow} / {staminaMax}</Text>
                </View>
                <Text style={styles.blurb}>Out of energy? Spend Crowns to refill your Stamina and keep working shifts.</Text>
                {STAMINA_PACKS.map((p) => {
                  const afford = crowns >= p.price;
                  const full = staminaNow >= staminaMax;
                  return (
                    <View key={p.id} style={styles.card} testID={`shop-stam-${p.id}`}>
                      <View style={[styles.iconBadge, { borderColor: COLORS.energy }]}>
                        <Ionicons name={p.icon as any} size={20} color={COLORS.energy} />
                      </View>
                      <View style={styles.cardMain}>
                        <Text style={styles.cardName}>{p.name}</Text>
                        <Text style={[styles.cardEffect, { color: COLORS.energy }]}>{p.subtitle}</Text>
                        <Text style={styles.cardDesc}>{p.description}</Text>
                      </View>
                      <BuyButton
                        price={p.price}
                        disabled={!afford || full}
                        onPress={async () => { const r = await refillStamina(p.price, p.amount); flash(r.ok, r.message); }}
                        testID={`shop-buy-${p.id}`}
                      />
                    </View>
                  );
                })}
              </>
            )}

            {g === "recruit" && (
              <>
                <Text style={styles.blurb}>Recruit Ward Defense healers with Crowns. Each pull grants a random unit — duplicates become Shards. Spend Shards + Ward Coins to raise a unit's permanent Unit Mastery Level (1-{MASTERY_LEVEL_CAP}). Mastery Level is separate from the temporary Merge Rank you gain by merging units mid-battle. Tap a unit for details.</Text>
                <Pressable
                  style={[styles.recruitBtn, crowns < GACHA_COST && styles.recruitBtnDisabled]}
                  disabled={crowns < GACHA_COST}
                  onPress={async () => { const r = await pullGacha(); flash(r.ok, r.message); }}
                  testID="shop-gacha-pull"
                >
                  <Ionicons name="sparkles" size={16} color={crowns < GACHA_COST ? COLORS.onSurfaceTertiary : COLORS.onBrand} />
                  <Text style={[styles.recruitBtnTxt, crowns < GACHA_COST && { color: COLORS.onSurfaceTertiary }]}>Recruit a Healer</Text>
                  <View style={styles.recruitCost}>
                    <Ionicons name="diamond" size={12} color={crowns < GACHA_COST ? COLORS.onSurfaceTertiary : COLORS.onBrand} />
                    <Text style={[styles.recruitCostTxt, crowns < GACHA_COST && { color: COLORS.onSurfaceTertiary }]}>{GACHA_COST}</Text>
                  </View>
                </Pressable>
                <Text style={styles.collectionLabel}>
                  COLLECTION · {WARD_UNIT_IDS.filter((uid) => (player.owned_units || {})[uid]).length}/{WARD_UNIT_IDS.length}
                </Text>
                {WARD_UNIT_IDS.map((uid) => {
                  const m = WARD_UNIT_META[uid];
                  const level = (player.owned_units || {})[uid] || 0;
                  const shards = (player.unit_shards || {})[uid] || 0;
                  const owned = level > 0;
                  return (
                    <Pressable key={uid} onPress={() => owned && setInfoUnitId(uid)} style={[styles.card, !owned && { opacity: 0.55 }]} testID={`shop-unit-${uid}`}>
                      <View style={[styles.iconBadge, { borderColor: owned ? m.color : COLORS.border }]}>
                        <Ionicons name={owned ? "shield-checkmark" : "lock-closed"} size={18} color={owned ? m.color : COLORS.onSurfaceTertiary} />
                      </View>
                      <View style={styles.cardMain}>
                        <View style={styles.cardHead}>
                          <Text style={styles.cardName}>{m.name}</Text>
                          {owned && <Text style={[styles.ownedTag, { color: m.color }]}>Mastery Lv.{level}</Text>}
                        </View>
                        <Text style={[styles.cardEffect, { color: owned ? m.color : COLORS.onSurfaceTertiary }]}>{m.category} · {m.apCost} AP</Text>
                        <Text style={styles.cardDesc}>{m.blurb}</Text>
                        {owned && <Text style={styles.shardTxt}>💠 {shards} shard{shards !== 1 ? "s" : ""}</Text>}
                      </View>
                      {owned ? (
                        <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
                      ) : (
                        <View style={styles.ownedBadge}><Ionicons name="help-circle-outline" size={16} color={COLORS.onSurfaceTertiary} /><Text style={[styles.ownedBadgeTxt, { color: COLORS.onSurfaceTertiary }]}>Locked</Text></View>
                      )}
                    </Pressable>
                  );
                })}
              </>
            )}

            {g === "upgrades" && (
              <>
                <Text style={styles.blurb}>Permanent upgrades are one-time, premium purchases. Once bought, they apply to every standard battle forever.</Text>
                {UPGRADES.map((u) => {
                  const owned = (player.owned_upgrades || []).includes(u.id);
                  const afford = crowns >= u.price;
                  return (
                    <View key={u.id} style={[styles.card, styles.premiumCard]} testID={`shop-upg-${u.id}`}>
                      <View style={[styles.iconBadge, { borderColor: COLORS.brand }]}>
                        <Ionicons name={u.icon as any} size={20} color={COLORS.brand} />
                      </View>
                      <View style={styles.cardMain}>
                        <Text style={styles.cardName}>{u.name}</Text>
                        <Text style={[styles.cardEffect, { color: COLORS.brand }]}>{u.subtitle}</Text>
                        <Text style={styles.cardDesc}>{u.description}</Text>
                      </View>
                      {owned ? (
                        <View style={styles.ownedBadge} testID={`shop-owned-${u.id}`}>
                          <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
                          <Text style={styles.ownedBadgeTxt}>Owned</Text>
                        </View>
                      ) : (
                        <BuyButton
                          price={u.price}
                          disabled={!afford}
                          onPress={async () => { const r = await purchaseUpgrade(u.id, u.price); flash(r.ok, r.message); }}
                          testID={`shop-buy-${u.id}`}
                        />
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {g === "skins" && (
              <>
                <Text style={styles.blurb}>Skins are purely cosmetic auras for your heroes — they never change stats or battle outcomes.</Text>
                {/* Default look option */}
                <View style={styles.card}>
                  <View style={[styles.auraSwatch, { backgroundColor: COLORS.surfaceTertiary, borderColor: COLORS.borderStrong }]}>
                    <Ionicons name="person" size={20} color={COLORS.onSurfaceSecondary} />
                  </View>
                  <View style={styles.cardMain}>
                    <Text style={styles.cardName}>Default Look</Text>
                    <Text style={styles.cardDesc}>No aura — your heroes' original appearance.</Text>
                  </View>
                  {(player.equipped_skin || "") === "" ? (
                    <View style={styles.ownedBadge}><Ionicons name="checkmark-circle" size={16} color={COLORS.success} /><Text style={styles.ownedBadgeTxt}>Equipped</Text></View>
                  ) : (
                    <Pressable style={styles.equipBtn} onPress={async () => { const r = await equipSkin(""); flash(r.ok, r.message); }} testID="shop-skin-default">
                      <Text style={styles.equipBtnTxt}>Use</Text>
                    </Pressable>
                  )}
                </View>
                {SKINS.map((s) => {
                  const owned = (player.owned_skins || []).includes(s.id);
                  const equipped = player.equipped_skin === s.id;
                  const afford = crowns >= s.price;
                  return (
                    <View key={s.id} style={styles.card} testID={`shop-skin-${s.id}`}>
                      <View style={[styles.auraSwatch, { backgroundColor: s.auraColor + "33", borderColor: s.accentColor }]}>
                        <Ionicons name={s.icon as any} size={20} color={s.accentColor} />
                      </View>
                      <View style={styles.cardMain}>
                        <Text style={styles.cardName}>{s.name}</Text>
                        <Text style={[styles.cardEffect, { color: s.accentColor }]}>{s.subtitle} • Cosmetic</Text>
                        <Text style={styles.cardDesc}>{s.description}</Text>
                      </View>
                      {!owned ? (
                        <BuyButton
                          price={s.price}
                          disabled={!afford}
                          onPress={async () => { const r = await purchaseSkin(s.id, s.price); flash(r.ok, r.message); }}
                          testID={`shop-buy-${s.id}`}
                        />
                      ) : equipped ? (
                        <View style={styles.ownedBadge}><Ionicons name="checkmark-circle" size={16} color={COLORS.success} /><Text style={styles.ownedBadgeTxt}>Equipped</Text></View>
                      ) : (
                        <Pressable style={styles.equipBtn} onPress={async () => { const r = await equipSkin(s.id); flash(r.ok, r.message); }} testID={`shop-equip-${s.id}`}>
                          <Text style={styles.equipBtnTxt}>Equip</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {g === "premium" && (
              <>
                <Text style={styles.blurb}>
                  Foundation preview only — nothing here is purchasable yet. No real-money purchases,
                  live trading, or subscriptions are active. See the Economy Guide for full details.
                </Text>

                <Pressable style={styles.card} onPress={() => router.push("/materials")} testID="shop-materials-guide">
                  <View style={[styles.iconBadge, { borderColor: COLORS.brand }]}>
                    <Ionicons name="cube-outline" size={20} color={COLORS.brand} />
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardName}>Material Guide</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
                    </View>
                    <Text style={styles.cardDesc}>Every currency and material — where to earn it and what it's for.</Text>
                  </View>
                </Pressable>

                <Text style={styles.collectionLabel}>CURRENCIES</Text>
                {CURRENCIES.filter((c) => c.id !== "crowns" && c.id !== "codex_shards").map((c) => {
                  const balance =
                    c.id === "insight_crystals" ? insightCrystals :
                    c.id === "refined_lotus_gems" ? refinedLotusGems :
                    c.id === "lotus_gems_paid" ? lotusGemsPaid :
                    player.ward_sigils || 0;
                  return (
                    <View key={c.id} style={styles.card} testID={`shop-currency-${c.id}`}>
                      <View style={[styles.iconBadge, { borderColor: COLORS.borderStrong }]}>
                        <Ionicons name={c.icon as any} size={20} color={COLORS.onSurfaceSecondary} />
                      </View>
                      <View style={styles.cardMain}>
                        <View style={styles.cardHead}>
                          <Text style={styles.cardName}>{c.displayName}</Text>
                          <Text style={styles.ownedTag}>{balance}</Text>
                        </View>
                        <Text style={styles.cardEffect}>{c.tagline}</Text>
                        <Text style={styles.cardDesc}>Earned from: {c.earnedFrom}</Text>
                      </View>
                    </View>
                  );
                })}

                <Text style={styles.collectionLabel}>SANCTUARY BANK</Text>
                <Pressable style={styles.card} onPress={() => setBankOpen(true)} testID="shop-sanctuary-bank">
                  <View style={[styles.iconBadge, { borderColor: COLORS.protection }]}>
                    <Ionicons name="business" size={20} color={COLORS.protection} />
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardName}>Sanctuary Bank</Text>
                    </View>
                    <Text style={styles.cardDesc}>Exchange Insight Crystals for Refined Lotus Gems. Tap to view rates & exchange.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
                </Pressable>

                <Text style={styles.collectionLabel}>SANCTUARY BAZAAR</Text>
                <Pressable style={styles.card} onPress={() => setBazaarOpen(true)} testID="shop-sanctuary-bazaar">
                  <View style={[styles.iconBadge, { borderColor: COLORS.storm }]}>
                    <Ionicons name="storefront" size={20} color={COLORS.storm} />
                  </View>
                  <View style={styles.cardMain}>
                    <View style={styles.cardHead}>
                      <Text style={styles.cardName}>Sanctuary Bazaar</Text>
                      <Text style={styles.foundationTag}>FUTURE</Text>
                    </View>
                    <Text style={styles.cardDesc}>Planned player-to-player trading. Not live yet. Tap to view what will be tradeable.</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.onSurfaceTertiary} />
                </Pressable>

                <Text style={styles.collectionLabel}>LOTUS GEM BUNDLES · WEEKLY (PLANNED)</Text>
                {WEEKLY_GEM_BUNDLES.map((b) => (
                  <View key={b.id} style={[styles.card, styles.premiumCard]} testID={`shop-bundle-${b.id}`}>
                    <View style={[styles.iconBadge, { borderColor: COLORS.brand }]}>
                      <Ionicons name="diamond-outline" size={20} color={COLORS.brand} />
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardName}>{b.totalGems.toLocaleString()} Lotus Gems</Text>
                      <Text style={[styles.cardEffect, { color: COLORS.brand }]}>{b.baseGems.toLocaleString()} base + {b.bonusPercent}% bonus</Text>
                      <Text style={styles.cardDesc}>{b.limit}</Text>
                    </View>
                    <Text style={styles.priceTagTxt}>${b.usd.toFixed(2)}</Text>
                  </View>
                ))}

                <Text style={styles.collectionLabel}>LOTUS GEM BUNDLES · MONTHLY (PLANNED)</Text>
                {MONTHLY_GEM_BUNDLES.map((b) => (
                  <View key={b.id} style={[styles.card, styles.premiumCard]} testID={`shop-bundle-${b.id}`}>
                    <View style={[styles.iconBadge, { borderColor: COLORS.brand }]}>
                      <Ionicons name="diamond-outline" size={20} color={COLORS.brand} />
                    </View>
                    <View style={styles.cardMain}>
                      <Text style={styles.cardName}>{b.totalGems.toLocaleString()} Lotus Gems</Text>
                      <Text style={[styles.cardEffect, { color: COLORS.brand }]}>{b.baseGems.toLocaleString()} base + {b.bonusPercent}% bonus</Text>
                      <Text style={styles.cardDesc}>{b.limit}</Text>
                    </View>
                    <Text style={styles.priceTagTxt}>${b.usd.toFixed(2)}</Text>
                  </View>
                ))}
                <Text style={styles.blurb}>
                  Status: {GEM_BUNDLE_STATUS === "planned" ? "planned — not purchasable" : GEM_BUNDLE_STATUS}.
                  Anchor: {ECONOMY_ANCHORS.lotusGemsPer99Cents} Lotus Gems ≈ $0.99.
                </Text>

                <Text style={styles.collectionLabel}>MONETIZATION PLACEHOLDERS</Text>
                {MONETIZATION_PRODUCTS.map((m) => (
                  <View key={m.id} style={styles.card} testID={`shop-product-${m.id}`}>
                    <View style={[styles.iconBadge, { borderColor: COLORS.energy }]}>
                      <Ionicons name="pricetag" size={20} color={COLORS.energy} />
                    </View>
                    <View style={styles.cardMain}>
                      <View style={styles.cardHead}>
                        <Text style={styles.cardName}>{m.name}</Text>
                        <Text style={styles.foundationTag}>NOT ACTIVE</Text>
                      </View>
                      <Text style={[styles.cardEffect, { color: COLORS.energy }]}>{m.priceUsd} · {m.cadence}</Text>
                      <Text style={styles.cardDesc}>{m.benefits.join(" · ")}</Text>
                    </View>
                  </View>
                ))}

                <Pressable style={styles.equipBtn} onPress={() => router.push("/economy")} testID="shop-open-economy-guide">
                  <Text style={styles.equipBtnTxt}>Open full Economy Guide →</Text>
                </Pressable>
              </>
            )}
          </View>
        ))}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {infoUnitId && (
        <UnitInfoModal
          typeId={infoUnitId}
          level={(player.owned_units || {})[infoUnitId] || 1}
          shards={(player.unit_shards || {})[infoUnitId] || 0}
          crowns={crowns}
          onUpgrade={async () => { const r = await upgradeUnitMastery(infoUnitId); flash(r.ok, r.message); }}
          onClose={() => setInfoUnitId(null)}
        />
      )}

      {bankOpen && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setBankOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Sanctuary Bank</Text>
                  <Text style={[styles.cardEffect, { color: COLORS.protection }]}>{insightCrystals.toLocaleString()} Insight Crystals available</Text>
                </View>
                <Pressable onPress={() => setBankOpen(false)} hitSlop={10} testID="bank-modal-close">
                  <Ionicons name="close" size={22} color={COLORS.onSurfaceSecondary} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: SPACING.sm, gap: SPACING.sm }}>
                <Text style={styles.cardDesc}>
                  Exchange Insight Crystals — earned through University study, wellness, and mastery —
                  into Refined Lotus Gems, an earned premium-equivalent currency accepted for select purchases.
                </Text>
                <Text style={styles.infoSectionLabel}>EXCHANGE</Text>
                {SANCTUARY_BANK_EXCHANGE_TABLE.map((row) => {
                  const canAfford = insightCrystals >= row.insightCrystals;
                  return (
                    <Pressable
                      key={row.insightCrystals}
                      style={[styles.statRow, { opacity: canAfford ? 1 : 0.5 }]}
                      disabled={!canAfford}
                      testID={`bank-exchange-${row.insightCrystals}`}
                      onPress={async () => {
                        const res = await exchangeInsightCrystals(row.insightCrystals);
                        flash(res.ok, res.message);
                      }}
                    >
                      <Text style={styles.statLabel}>{row.insightCrystals.toLocaleString()} Insight Crystals</Text>
                      <Text style={styles.statValue}>→ {row.refinedLotusGems} Refined Lotus Gems</Text>
                    </Pressable>
                  );
                })}
                <Text style={styles.infoSectionLabel}>CAPS</Text>
                <Text style={styles.cardDesc}>
                  Soft guidance for now — weekly cap {SANCTUARY_BANK_CAPS.weeklyRefinedGemCap} Refined Lotus Gems,
                  monthly cap {SANCTUARY_BANK_CAPS.monthlyRefinedGemCap} Refined Lotus Gems. Enforcement is coming soon.
                  {"\n"}{SANCTUARY_BANK_CAPS.specialEventBonusCapNote}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {bazaarOpen && (
        <Modal visible animationType="slide" transparent onRequestClose={() => setBazaarOpen(false)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>Sanctuary Bazaar</Text>
                  <Text style={[styles.cardEffect, { color: COLORS.storm }]}>Future placeholder · no live trading</Text>
                </View>
                <Pressable onPress={() => setBazaarOpen(false)} hitSlop={10} testID="bazaar-modal-close">
                  <Ionicons name="close" size={22} color={COLORS.onSurfaceSecondary} />
                </Pressable>
              </View>
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: SPACING.sm, gap: SPACING.sm }}>
                <Text style={styles.cardDesc}>
                  The Sanctuary Bazaar is a planned player-to-player trading space. It is not live —
                  this is a preview of what will and won't be tradeable once it launches.
                </Text>
                <Text style={styles.infoSectionLabel}>WILL BE TRADEABLE</Text>
                {SANCTUARY_BAZAAR_TRADEABLE.map((t) => (
                  <Text key={t} style={styles.cardDesc}>• {t}</Text>
                ))}
                <Text style={styles.infoSectionLabel}>NEVER TRADEABLE</Text>
                {SANCTUARY_BAZAAR_NON_TRADEABLE.map((t) => (
                  <Text key={t} style={styles.cardDesc}>• {t}</Text>
                ))}
                <Text style={styles.infoSectionLabel}>STATUS</Text>
                <Text style={styles.cardDesc}>
                  {SANCTUARY_BAZAAR_STATUS === "future-placeholder" ? "Future placeholder only — no live trading exists yet." : "Active"}
                </Text>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

type InfoTab = "overview" | "stats" | "merge" | "milestones" | "counters" | "lore";
const INFO_TABS: { id: InfoTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "merge", label: "Merge" },
  { id: "milestones", label: "Milestones" },
  { id: "counters", label: "Counters" },
  { id: "lore", label: "Lore" },
];

function UnitInfoModal({ typeId, level, shards, crowns, onUpgrade, onClose }: {
  typeId: string; level: number; shards: number; crowns: number;
  onUpgrade: () => void; onClose: () => void;
}) {
  const [infoTab, setInfoTab] = useState<InfoTab>("overview");
  const m = WARD_UNIT_META[typeId];
  const block = UNIT_STAT_BLOCKS[typeId];
  const req = getMasteryRequirement(level + 1);
  const curStats = getMasteryStats(typeId, level);
  const nextStats = req ? getMasteryStats(typeId, level + 1) : null;
  const unlocked = unlockedMilestones(typeId, level);
  const canAfford = !!req && shards >= req.shards && crowns >= req.coins;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{m.name}</Text>
              <Text style={[styles.cardEffect, { color: m.color }]}>{m.category} · Mastery Lv.{level}/{MASTERY_LEVEL_CAP}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} testID="unit-info-close">
              <Ionicons name="close" size={22} color={COLORS.onSurfaceSecondary} />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.infoTabsRow}>
            {INFO_TABS.map((t) => (
              <Pressable key={t.id} onPress={() => setInfoTab(t.id)} style={[styles.infoTab, infoTab === t.id && styles.infoTabActive]}>
                <Text style={[styles.infoTabTxt, infoTab === t.id && styles.infoTabTxtActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingVertical: SPACING.sm, gap: SPACING.sm }}>
            {infoTab === "overview" && (
              <>
                <Text style={styles.cardDesc}>{m.blurb}</Text>
                <Text style={styles.infoSectionLabel}>ROLE</Text>
                <Text style={styles.cardEffect}>{m.role} · {m.apCost} AP to deploy</Text>
                <Text style={styles.infoSectionLabel}>UNIT MASTERY vs MERGE RANK</Text>
                <Text style={styles.cardDesc}>
                  Unit Mastery Level is permanent — it grows outside battle using duplicate Shards
                  and Ward Coins. Merge Rank is temporary — it only grows by merging matching
                  {" " + m.name} units together during a single Ward Defense run, and resets when
                  the run ends. Leveling one never changes the other.
                </Text>
              </>
            )}

            {infoTab === "stats" && block && (
              <>
                <View style={styles.progressRow}>
                  <Text style={styles.infoSectionLabel}>SHARDS: {shards}{req ? ` / ${req.shards}` : ""}</Text>
                  <Text style={styles.infoSectionLabel}>WARD COINS: {crowns}{req ? ` / ${req.coins}` : ""}</Text>
                </View>
                {block.order.map((k) => (
                  <View key={k} style={styles.statRow}>
                    <Text style={styles.statLabel}>{block.labels[k]}</Text>
                    <Text style={styles.statValue}>
                      {round1(curStats[k])}{block.suffix[k]}
                      {nextStats && <Text style={styles.statNext}>  → {round1(nextStats[k])}{block.suffix[k]}</Text>}
                    </Text>
                  </View>
                ))}
                {req ? (
                  <Pressable
                    onPress={onUpgrade}
                    disabled={!canAfford}
                    style={[styles.upgradeBtn, !canAfford && styles.recruitBtnDisabled]}
                    testID="unit-info-upgrade"
                  >
                    <Text style={[styles.recruitBtnTxt, !canAfford && { color: COLORS.onSurfaceTertiary }]}>
                      Upgrade to Lv.{level + 1} — {req.shards} Shards + {req.coins} Coins
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={styles.infoSectionLabel}>MAX MASTERY LEVEL REACHED</Text>
                )}
              </>
            )}

            {infoTab === "merge" && (
              <>
                <Text style={styles.cardDesc}>
                  Merge Rank is battle-only and resets every run. Merge two matching{" "}
                  {m.name} units on the field to advance one rank:
                </Text>
                {MERGE_RANK_NAMES.map((n, i) => (
                  <Text key={n} style={styles.statLabel}>Rank {i + 1} — {n}</Text>
                ))}
                <Text style={styles.cardDesc}>
                  Higher ranks increase this unit's damage, range, targets, or support strength
                  for the rest of the run only. Merging never spends Shards or affects Mastery Level.
                </Text>
              </>
            )}

            {infoTab === "milestones" && block && (
              <>
                {block.milestones.map((ms) => {
                  const isUnlocked = level >= ms.level;
                  return (
                    <View key={ms.level} style={[styles.statRow, { opacity: isUnlocked ? 1 : 0.5 }]}>
                      <Ionicons name={isUnlocked ? "checkmark-circle" : "lock-closed"} size={14} color={isUnlocked ? COLORS.success : COLORS.onSurfaceTertiary} />
                      <View style={{ flex: 1, marginLeft: 6 }}>
                        <Text style={styles.statLabel}>Lv.{ms.level} — {ms.title}</Text>
                        <Text style={styles.cardDesc}>{ms.desc}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}

            {infoTab === "counters" && (
              <>
                <Text style={styles.infoSectionLabel}>STRONG AGAINST</Text>
                <Text style={styles.cardDesc}>See enemy preview cards in the Ward Defense lobby for this unit's best matchups.</Text>
                <Text style={styles.infoSectionLabel}>CLINICAL SEQUENCE</Text>
                <Text style={styles.cardDesc}>
                  {m.role === "ASSESS"
                    ? "Deploy first against unclear/Hidden Pathology enemies — reveal before treating."
                    : "Works best once threats are assessed/revealed by an Assess unit."}
                </Text>
              </>
            )}

            {infoTab === "lore" && (
              <Text style={styles.cardDesc}>{m.blurb} A dedicated healer of the Ward, sworn to Assess the threat, Treat the cause, Stabilize the ward, and Reassess the response.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function round1(n: number | undefined) {
  if (n == null) return "-";
  return Math.round(n * 10) / 10;
}

function BuyButton({ price, disabled, onPress, testID }: { price: number; disabled?: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.buyBtn, disabled && styles.buyBtnDisabled]}
      testID={testID}
    >
      <Ionicons name="diamond" size={12} color={disabled ? COLORS.onSurfaceTertiary : COLORS.onBrand} />
      <Text style={[styles.buyBtnTxt, disabled && styles.buyBtnTxtDisabled]}>{price}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center", gap: SPACING.md },
  empty: { color: COLORS.onSurfaceSecondary, textAlign: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 2 },
  infoBtn: { padding: 2 },
  foundationTag: {
    color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  priceTagTxt: { color: COLORS.brand, fontSize: 14, fontWeight: "800" },
  title: { color: COLORS.onSurface, fontSize: 20, fontWeight: "800" },
  subtitle: { color: COLORS.onSurfaceTertiary, fontSize: 12, marginTop: 1 },
  groupHeading: { color: COLORS.onSurface, fontSize: 15, fontWeight: "800", letterSpacing: 0.5, marginTop: SPACING.sm },
  banner: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginTop: SPACING.sm,
    padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: COLORS.surfaceSecondary,
  },
  bannerTxt: { fontSize: 13, fontWeight: "600", flex: 1 },
  scroll: { padding: SPACING.lg, gap: SPACING.md },
  blurb: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, marginBottom: SPACING.xs },
  card: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  premiumCard: { borderColor: COLORS.brandSecondary, backgroundColor: COLORS.brandTertiary + "40" },
  cardMain: { flex: 1, gap: 2 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  cardName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  cardSub: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  cardEffect: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  cardDesc: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 16, marginTop: 1 },
  ownedTag: { color: COLORS.brand, fontSize: 12, fontWeight: "700" },
  iconBadge: {
    width: 40, height: 40, borderRadius: RADIUS.md, borderWidth: 1,
    alignItems: "center", justifyContent: "center", backgroundColor: COLORS.surfaceTertiary,
  },
  auraSwatch: {
    width: 44, height: 44, borderRadius: RADIUS.pill, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  buyBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.brand, paddingHorizontal: SPACING.md, paddingVertical: 9,
    borderRadius: RADIUS.pill, minWidth: 62, justifyContent: "center",
  },
  buyBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
  buyBtnTxt: { color: COLORS.onBrand, fontWeight: "800", fontSize: 14 },
  buyBtnTxtDisabled: { color: COLORS.onSurfaceTertiary },
  equipBtn: {
    backgroundColor: COLORS.surfaceTertiary, borderColor: COLORS.borderStrong, borderWidth: 1,
    paddingHorizontal: SPACING.md, paddingVertical: 9, borderRadius: RADIUS.pill, minWidth: 62, alignItems: "center",
  },
  equipBtnTxt: { color: COLORS.onSurface, fontWeight: "700", fontSize: 13 },
  ownedBadge: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 62, justifyContent: "center" },
  ownedBadgeTxt: { color: COLORS.success, fontWeight: "700", fontSize: 12 },
  staminaCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderColor: COLORS.border, borderWidth: 1,
    borderRadius: RADIUS.md, padding: SPACING.md,
  },
  staminaTxt: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  recruitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg,
  },
  recruitBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
  recruitBtnTxt: { color: COLORS.onBrand, fontWeight: "800", fontSize: 15 },
  recruitCost: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#00000030", borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3,
  },
  recruitCostTxt: { color: COLORS.onBrand, fontWeight: "800", fontSize: 13 },
  collectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: SPACING.sm },
  shardTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "700", marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "#00000090", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg, maxHeight: "82%", borderTopWidth: 1, borderColor: COLORS.border,
  },
  modalHead: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm, marginBottom: SPACING.sm },
  infoTabsRow: { flexDirection: "row", gap: SPACING.xs, paddingBottom: SPACING.sm },
  infoTab: {
    paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  infoTabActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  infoTabTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  infoTabTxtActive: { color: COLORS.onBrand },
  infoSectionLabel: { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: SPACING.xs },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 3 },
  statLabel: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  statValue: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  statNext: { color: COLORS.success, fontSize: 12, fontWeight: "700" },
  upgradeBtn: {
    backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    alignItems: "center", marginTop: SPACING.sm,
  },
});
