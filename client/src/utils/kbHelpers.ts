import { z } from "zod";
import { KBPage, User } from "../types";

export const checkIsUUID = (str?: string | null) => {
  if (!str) return false;
  const parsed = z.string().uuid().safeParse(str);
  const isUUID = parsed.success;
  return isUUID;
};

export const getKBSharingObj = (page: KBPage) => {
  return {
    title: page.title,
    text: page.description,
    url: `commons.libretexts.org/kb/page/${page.slug}`,
  };
};

/**
 * Checks if user has a role of 'kbeditor' in the 'libretexts' org
 * @param user - the user object
 * @returns [boolean] - true if user has 'kbeditor' role in 'libretexts' org (or is superadmin), false otherwise
 */
export const canEditKB = (user?: User): boolean => {
  if (!user || !user.roles) return false;
  const orgMatches = user.roles.filter((org) => org.org === "libretexts");
  const superAdmin = user.roles.some((role) => role.role === "superadmin");
  if (superAdmin) return true; // superadmins can edit KB
  return orgMatches.some((match) => match.role === "kbeditor");
};
