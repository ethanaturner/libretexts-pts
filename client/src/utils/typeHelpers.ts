import { CatalogLocation } from "../types";

export function isCatalogLocation(
  location: string
): location is CatalogLocation {
  return ["central", "campus", "all"].includes(location);
}

export function hasMessage(obj: any): obj is { message: string } {
  return "message" in obj;
}

export function hasResponse(obj: any): obj is { response: any } {
  return "response" in obj;
}

export function hasErrorData(obj: any): obj is { data: object } {
  return "data" in obj;
}

export function hasErrorDataMsg(obj: any): obj is { errMsg: string } {
  return "errMsg" in obj;
}

export function hasErrorDataErrors(obj: any): obj is { errors: any[] } {
  return "errors" in obj;
}

export function hasErrorStatusCode(obj: any): obj is { statusCode: number } {
  return "statusCode" in obj;
}
