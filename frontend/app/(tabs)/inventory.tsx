/**
 * (tabs)/inventory — thin tab shell that delegates to the shared /item-bag screen.
 *
 * Inventory is a tab-level destination. Expo Router needs a file here so it can
 * register the route and show it in the bottom bar. All content lives in the
 * top-level app/item-bag.tsx so non-tab deep-links (e.g. /item-bag) still work.
 */
// TODO(icons): replace tab-inventory.png with final asset once icon pack ships
export { default } from "../item-bag";
