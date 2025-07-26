/**
 * TimezoneService
 * Determines timezone from US business address (state + ZIP code)
 * Optimized for local US businesses
 */

interface AddressInfo {
  state: string;
  postalCode: string;
  country?: string;
}

export class TimezoneService {
  /**
   * Get timezone from business address
   * @param address - Business address information
   * @returns IANA timezone string or default
   */
  static getTimezoneFromAddress(address: AddressInfo): string {
    const { state, postalCode, country = "United States" } = address;

    // Only handle US addresses for now
    if (country !== "United States" && country !== "US") {
      return "America/New_York"; // Default for non-US
    }

    // Normalize state (handle both abbreviations and full names)
    const normalizedState = this.normalizeState(state);

    // Handle states that span multiple timezones
    if (this.isMultiTimezoneState(normalizedState)) {
      return this.getTimezoneByZip(normalizedState, postalCode);
    }

    // Single timezone states
    return this.getStateTimezone(normalizedState);
  }

  /**
   * Normalize state name to abbreviation
   */
  private static normalizeState(state: string): string {
    const stateMap: Record<string, string> = {
      alabama: "AL",
      alaska: "AK",
      arizona: "AZ",
      arkansas: "AR",
      california: "CA",
      colorado: "CO",
      connecticut: "CT",
      delaware: "DE",
      florida: "FL",
      georgia: "GA",
      hawaii: "HI",
      idaho: "ID",
      illinois: "IL",
      indiana: "IN",
      iowa: "IA",
      kansas: "KS",
      kentucky: "KY",
      louisiana: "LA",
      maine: "ME",
      maryland: "MD",
      massachusetts: "MA",
      michigan: "MI",
      minnesota: "MN",
      mississippi: "MS",
      missouri: "MO",
      montana: "MT",
      nebraska: "NE",
      nevada: "NV",
      "new hampshire": "NH",
      "new jersey": "NJ",
      "new mexico": "NM",
      "new york": "NY",
      "north carolina": "NC",
      "north dakota": "ND",
      ohio: "OH",
      oklahoma: "OK",
      oregon: "OR",
      pennsylvania: "PA",
      "rhode island": "RI",
      "south carolina": "SC",
      "south dakota": "SD",
      tennessee: "TN",
      texas: "TX",
      utah: "UT",
      vermont: "VT",
      virginia: "VA",
      washington: "WA",
      "west virginia": "WV",
      wisconsin: "WI",
      wyoming: "WY",
    };

    const lower = state.toLowerCase().trim();
    return stateMap[lower] || state.toUpperCase();
  }

  /**
   * Check if state spans multiple timezones
   */
  private static isMultiTimezoneState(state: string): boolean {
    const multiTimezoneStates = [
      "FL",
      "TX",
      "KS",
      "NE",
      "ND",
      "SD",
      "TN",
      "KY",
      "IN",
      "MI",
      "OR",
      "ID",
      "AK",
    ];
    return multiTimezoneStates.includes(state);
  }

  /**
   * Get timezone for single-timezone states
   */
  private static getStateTimezone(state: string): string {
    const stateTimezones: Record<string, string> = {
      // Eastern Time
      ME: "America/New_York",
      NH: "America/New_York",
      VT: "America/New_York",
      MA: "America/New_York",
      RI: "America/New_York",
      CT: "America/New_York",
      NY: "America/New_York",
      NJ: "America/New_York",
      PA: "America/New_York",
      DE: "America/New_York",
      MD: "America/New_York",
      WV: "America/New_York",
      VA: "America/New_York",
      NC: "America/New_York",
      SC: "America/New_York",
      GA: "America/New_York",
      OH: "America/New_York",

      // Central Time
      AL: "America/Chicago",
      MS: "America/Chicago",
      LA: "America/Chicago",
      AR: "America/Chicago",
      MO: "America/Chicago",
      IA: "America/Chicago",
      MN: "America/Chicago",
      WI: "America/Chicago",
      IL: "America/Chicago",
      OK: "America/Chicago",
      WY: "America/Chicago",

      // Mountain Time
      MT: "America/Denver",
      CO: "America/Denver",
      NM: "America/Denver",
      UT: "America/Denver",
      AZ: "America/Phoenix", // Arizona doesn't observe DST
      NV: "America/Los_Angeles", // Nevada is Pacific Time

      // Pacific Time
      CA: "America/Los_Angeles",
      WA: "America/Los_Angeles",

      // Hawaii-Aleutian
      HI: "Pacific/Honolulu",
    };

    return stateTimezones[state] || "America/New_York"; // Default to Eastern
  }

  /**
   * Get timezone by ZIP code for multi-timezone states
   * Simplified rules for common cases
   */
  private static getTimezoneByZip(state: string, postalCode: string): string {
    const zip = parseInt(postalCode.substring(0, 5));

    switch (state) {
      case "FL":
        // Florida: Eastern except western panhandle
        return zip >= 32400 && zip <= 32599
          ? "America/Chicago"
          : "America/New_York";

      case "TX":
        // Texas: Central except El Paso area
        return zip >= 79900 && zip <= 79999
          ? "America/Denver"
          : "America/Chicago";

      case "KS":
        // Kansas: Central except western counties
        return zip >= 67800 ? "America/Denver" : "America/Chicago";

      case "NE":
        // Nebraska: Central except western counties
        return zip >= 69100 ? "America/Denver" : "America/Chicago";

      case "ND":
        // North Dakota: Central except western counties
        return zip >= 58600 ? "America/Denver" : "America/Chicago";

      case "SD":
        // South Dakota: Central except western counties
        return zip >= 57700 ? "America/Denver" : "America/Chicago";

      case "TN":
        // Tennessee: Central except eastern counties
        return zip >= 37300 ? "America/New_York" : "America/Chicago";

      case "KY":
        // Kentucky: Eastern except western counties
        return zip >= 40000 && zip <= 42700
          ? "America/Chicago"
          : "America/New_York";

      case "IN":
        // Indiana: Eastern except northwest and southwest
        return (zip >= 46300 && zip <= 47900) || (zip >= 47500 && zip <= 47900)
          ? "America/Chicago"
          : "America/New_York";

      case "MI":
        // Michigan: Eastern except western UP
        return zip >= 49900 ? "America/Chicago" : "America/New_York";

      case "OR":
        // Oregon: Pacific except eastern counties
        return zip >= 97900 ? "America/Denver" : "America/Los_Angeles";

      case "ID":
        // Idaho: Mountain except northern panhandle
        return zip >= 83800 ? "America/Los_Angeles" : "America/Denver";

      case "AK":
        // Alaska: Alaska time except Aleutian Islands
        return zip >= 99500 ? "Pacific/Honolulu" : "America/Anchorage";

      default:
        return this.getStateTimezone(state);
    }
  }
}
