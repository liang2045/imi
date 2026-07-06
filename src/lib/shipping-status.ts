import type { ShipmentEvent } from "./types";

const manualPromptPattern = /(?:请|需|需要|可|可以)?.{0,8}(?:人工|手工).{0,8}(?:确认签收|签收确认)|(?:确认签收|签收确认).{0,8}(?:按钮|操作|人工|手工)|人工维护或确认签收/;
const explicitSignedPattern = /已签收|签收人|本人签收|代收|已由.{0,12}签收|快件已被.{0,12}签收|驿站.{0,12}签收/;
const manualConfirmedPattern = /已人工确认签收|人工已确认签收|已手工确认签收/;

export function isSignedShipmentDescription(description: string) {
  const text = description.trim();
  if (!text) return false;
  if (manualConfirmedPattern.test(text)) return true;
  if (manualPromptPattern.test(text) && !explicitSignedPattern.test(text)) return false;
  return explicitSignedPattern.test(text);
}

export function hasSignedEvent(events?: ShipmentEvent[]) {
  return events?.some((event) => isSignedShipmentDescription(event.description)) || false;
}

export function hasOnlyManualSignedPrompt(events?: ShipmentEvent[]) {
  if (!events?.length) return false;
  const descriptions = events.map((event) => event.description).join(" ");
  return manualPromptPattern.test(descriptions) && !hasSignedEvent(events);
}
