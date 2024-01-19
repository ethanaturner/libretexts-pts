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

export function sortXByOrderOfY<T, K>(x: T[], y: K[]): T[] {
  // Create a map of elements in array Y to their indices
  const mapY = new Map();
  y.forEach((element, index) => {
    mapY.set(element, index);
  });

  // Sort array X based on the order in array Y
  x.sort((a, b) => {
    const indexA = mapY.has(a) ? mapY.get(a) : Infinity;
    const indexB = mapY.has(b) ? mapY.get(b) : Infinity;
    return indexA - indexB;
  });

  return x;
}

export function base64ToBlob(
  base64String: string,
  contentType: string
): Blob | null {
  const byteCharacters = atob(base64String);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

export function getBookFilterText(filter: string) {
  switch (filter) {
    case "bookLibrary":
      return "Library";
    case "bookSubject":
      return "Subject";
    case "bookLocation":
      return "Location";
    case "bookLicense":
      return "License";
    case "bookAuthor":
      return "Author";
    case "bookCourse":
      return "Course";
    case "bookPublisher":
      return "Publisher";
    case "bookAffiliation":
      return "Affiliation";
    case "bookCID":
      return "C-ID";
    default:
      return "";
  }
}

export function getAssetFilterText(key: string) {
  switch (key) {
    case "license":
      return "License";
    case "licenseVersion":
      return "License Version";
    case "org":
      return "Organization";
    case "fileType":
      return "File Type";
    default:
      return "";
  }
}
