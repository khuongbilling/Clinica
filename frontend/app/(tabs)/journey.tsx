/**
 * (tabs)/journey — thin tab shell that delegates to the shared /journey screen.
 *
 * Journey is a tab-level destination. Expo Router needs a file here so it can
 * register the route and show it in the bottom bar. All content lives in the
 * top-level app/journey.tsx so non-tab deep-links (e.g. /journey) still work.
 */
// TODO(icons): replace tab-journey.png with final asset once icon pack ships
export { default } from "../journey";
