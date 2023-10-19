import { model, Schema, Document } from "mongoose";
import { PROJECT_FILES_ACCESS_SETTINGS } from "../util/projectutils.js";

// Not stored in schema, but used in API
export type FileInterfacePath = {
  fileID: string;
  name: string;
};

export type FileInterfaceAccess =
  | "public"
  | "users"
  | "instructors"
  | "team"
  | "mixed";

export interface RawFileInterface {
  fileID: string;
  name?: string;
  access?: FileInterfaceAccess;
  storageType: "file" | "folder";
  size: number;
  description?: string;
  parent?: string;
  createdBy?: string;
  downloadCount?: number;
}

export interface FileInterface extends RawFileInterface, Document {}

const FileSchema = new Schema<FileInterface>({
  /**
   * Unique identifier of the file entry.
   */
  fileID: {
    type: String,
    required: true,
  },
  /**
   * UI-name of the file entry.
   */
  name: String,
  /**
   * Indicates which users can download the file on Commons.
   */
  access: {
    type: String,
    enum: PROJECT_FILES_ACCESS_SETTINGS,
  },
  /**
   * Indicates whether the entry is a "file" or "folder".
   */
  storageType: {
    type: String,
    enum: ["file", "folder"],
    default: "file",
  },
  /**
   * Entry size in bytes, set to 0 if entry is a "folder".
   */
  size: {
    type: Number,
    default: 0,
  },
  /**
   * UI text describing the entry and its contents.
   */
  description: String,
  /**
   * Identifier of the immediate parent in the hierarchy. Empty string if the
   * entry is at the top-level of the hierarchy.
   */
  parent: String,
  /**
   * UUID of the user that uploaded or created the entry.
   */
  createdBy: String,
  /**
   * Number of times the entry has been downloaded on Commons, if entry is a "file".
   */
  downloadCount: Number,
});

// We don't need export Mongoose model()  here because we only need the schema, not a seperate collection.
export default FileSchema;
