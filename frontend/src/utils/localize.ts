/**
 * Temperature and text localization utilities.
 *
 * Extracted from multiple components that each had their own copy of
 * the °C → °F replacement logic.
 */

/** Replace all `<number>C` patterns in text with their Fahrenheit equivalents. */
export function localizeTempInText(text: string, tempUnit: "C" | "F"): string {
  if (tempUnit === "C") return text;
  return text.replace(/(\d+\.?\d*)C/g, (_match, p1) => {
    const celsius = parseFloat(p1);
    const fahrenheit = (celsius * 9) / 5 + 32;
    return `${fahrenheit.toFixed(1)}F`;
  });
}

/** Format a Celsius value according to the user's preferred unit. */
export function formatTemperature(celsius: number, unit: "C" | "F"): string {
  if (unit === "F") {
    return `${((celsius * 9) / 5 + 32).toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}
