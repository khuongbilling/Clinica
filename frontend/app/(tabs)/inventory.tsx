/**
 * (tabs)/inventory — thin tab shell that delegates to the shared /item-bag screen.
 *
 * Inventory is a tab-level destination. Expo Router needs a file here so it can
 * register the route and show it in the bottom bar. All content lives in the
 * top-level app/item-bag.tsx so non-tab deep-links (e.g. /item-bag) still work.
 */
// Icon placeholder: tab-inventory.png is a stand-in; replace when the final icon set ships (tracked as follow-up in icon-pack task)
export { default } from "../item-bag";
