import type { API_TYPES } from "../constants.js";

// Inline case converters to remove lodash dependency
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

function toCamelCase(str: string): string {
  return str.replace(/[-_\s]+(.)?/g, (_match, chr: string | undefined) =>
    chr ? chr.toUpperCase() : "",
  );
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

/**
 * Takes a Keybase API input JavaScript object and recursively formats it into
 * snake_case or kebab-case for the service.
 */
export function formatAPIObjectInput(obj: any, apiType: API_TYPES): any {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => formatAPIObjectInput(item, apiType));
  }
  return Object.keys(obj).reduce<Record<string, unknown>>((newObj, key) => {
    const formattedKey = apiType === "wallet" ? toKebabCase(key) : toSnakeCase(key);
    if (typeof obj[key] === "object") {
      return { ...newObj, [formattedKey]: formatAPIObjectInput(obj[key], apiType) };
    }
    return { ...newObj, [formattedKey]: obj[key] };
  }, {});
}

// Output blacklist: paths where camelCase conversion should be skipped
const transformsBlacklist: Record<string, Record<string, string[][][]>> = {
  team: {},
  wallet: {},
  chat: {
    read: [["messages", null as any, "msg", "reactions", "reactions", null as any]],
  },
};

export type FormatAPIObjectOutputContext = {
  apiName: API_TYPES;
  method: string;
  parent?: any[];
};

function matchBlacklist(context?: FormatAPIObjectOutputContext | null): boolean {
  if (!context || !transformsBlacklist[context.apiName]?.[context.method]) {
    return false;
  }
  const parentLength = context.parent ? context.parent.length : 0;
  for (const matcher of transformsBlacklist[context.apiName][context.method]) {
    if (matcher.length !== parentLength) continue;
    let mismatch = false;
    for (const [i, desiredValue] of matcher.entries()) {
      if (desiredValue === null) continue;
      if (context.parent?.[i] !== desiredValue) {
        mismatch = true;
        break;
      }
    }
    if (!mismatch) return true;
  }
  return false;
}

function buildContext(
  context: FormatAPIObjectOutputContext | null,
  key: any,
): FormatAPIObjectOutputContext | null {
  if (!context) return null;
  const copied: FormatAPIObjectOutputContext = { ...context };
  copied.parent = copied.parent ? [...copied.parent, key] : [key];
  return copied;
}

/**
 * Takes a Keybase output object and formats it in a more digestible JavaScript
 * style by using camelCase instead of snake_case.
 */
export function formatAPIObjectOutput(
  obj: any,
  context: FormatAPIObjectOutputContext | null,
): any {
  if (obj == null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item, i) => formatAPIObjectOutput(item, buildContext(context, i)));
  }
  return Object.keys(obj).reduce<Record<string, unknown>>((newObj, key) => {
    const formattedKey = matchBlacklist(context) ? key : toCamelCase(key);
    if (typeof obj[key] === "object") {
      return { ...newObj, [formattedKey]: formatAPIObjectOutput(obj[key], buildContext(context, key)) };
    }
    return { ...newObj, [formattedKey]: obj[key] };
  }, {});
}
