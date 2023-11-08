import { format as formatDate, parseISO } from "date-fns";
import { GenericKeyTextValueObj } from "../types";
import { FieldNamesMarkedBoolean } from "react-hook-form";
import { SemanticCOLORS } from "semantic-ui-react";

/**
 *
 * @param {GenericKeyTextValueObj<string>} options - array of valid sort option objects
 * @param {string} value - value to check
 * @returns Given value if valid, otherwise the first option in given array. Returns empty string if error is encountered
 */
export function parseSortOption(
  options: GenericKeyTextValueObj<string>[],
  value?: string
): string {
  let validSortOptions: string[] = [];
  options.map((item) => {
    validSortOptions.push(item.key);
  });

  if (validSortOptions.length === 0) {
    return "";
  }

  if (value && validSortOptions.includes(value)) {
    return value;
  }

  return validSortOptions[0];
}

/**
 * Safely parse and format a date string or Date object to desired display format.
 *
 * @param date - Date object or ISO date string to parse.
 * @returns Formatted date string.
 */
export function parseAndFormatDate(date: Date | string, formatString: string) {
  try {
    if (date instanceof Date) {
      return formatDate(date, formatString);
    }
    return formatDate(parseISO(date), formatString);
  } catch (e) {
    console.error(e);
  }
  return "Unknown Date";
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text).then(() => {
      alert("Copied text to clipboard.");
    });
  } catch (e) {
    console.error(e);
  }
}

/**
 * Calculates skip offset for server-side pagination
 * @param {number} page - Active page number (integer)
 * @param {number} offsetMultiplier - Number of records to return for each page
 * @returns {number} - The number of records to offset, or 0 if an error was encountered
 */
export function getPaginationOffset(
  page: number | string,
  offsetMultiplier = 25
) {
  const parsedPage = parseInt(page.toString());
  const parsedMultiplier = parseInt(offsetMultiplier.toString());
  if (!Number.isInteger(parsedPage) || !Number.isInteger(parsedMultiplier)) {
    return 0;
  }

  let offset = 0;
  if (parsedPage > 1) {
    offset = (parsedPage - 1) * offsetMultiplier;
  }

  return offset;
}

export function dirtyValues<T extends object>(
  dirtyFields: Partial<Readonly<FieldNamesMarkedBoolean<T>>>,
  allValues: T
): Partial<T> {
  const dirtyValues: Partial<T> = {};
  Object.keys(dirtyFields).forEach((key) => {
    dirtyValues[key as keyof T] = allValues[key as keyof T];
  });
  return dirtyValues;
}

export const SemanticCOLORSArray: SemanticCOLORS[] = [
  "red",
  "orange",
  "yellow",
  "olive",
  "green",
  "teal",
  "blue",
  "violet",
  "purple",
  "pink",
  "brown",
  "grey",
  "black",
];
