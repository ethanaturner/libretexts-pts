import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import { FileInterface } from "../models/file.js";
import FileAssetTags from "../models/fileassettags.js";
import AssetTagKey, { AssetTagKeyInterface } from "../models/assettagkey.js";
import { getRandomColor } from "../util/assettaggingutils.js";
import { Types, isObjectIdOrHexString } from "mongoose";
import {
  compareMongoIDs,
  isAssetTagFrameworkObject,
} from "../util/typeHelpers.js";

async function upsertAssetTags(
  file: FileInterface,
  tags: AssetTagInterface[]
): Promise<void> {
  try {
    const reqTags = tags;
    let refDoc = await FileAssetTags.findOne({ fileID: file._id });

    if (!refDoc) {
      refDoc = new FileAssetTags({
        fileID: file._id,
        tags: [],
      });
    }

    // Map keys to array and then search DB so we only have to do one query
    const keysInTags = reqTags.map((t) => t.key);
    const existingKeys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      title: { $in: keysInTags },
      isDeleted: { $ne: true },
    });

    const currTags = await AssetTag.find({ _id: { $in: refDoc?.tags } });
    const newTags: AssetTagInterface[] = [];

    for (const tag of reqTags) {
      const existingTag = currTags.find((t) => t._id.equals(tag._id));

      // If the tag already exists, update it
      if (existingTag) {
        existingTag.value = tag.value;
        existingTag.framework = tag.framework;
        existingTag.isDeleted = tag.isDeleted;
        existingTag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(existingKeys, existingTag)
        );
        await existingTag.save();
      }
      // If the tag is new, create it
      else {
        tag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(existingKeys, tag)
        );
        const newTag = new AssetTag({
          ...tag,
          uuid: v4(),
        });
        await newTag.save();
        newTags.push(newTag);
      }
    }

    const allTags = [...currTags, ...newTags];

    // // Remove deleted tags
    // // for (const tag of allTags) {
    // //   // If a tag is in the refDoc but not in the tags array, delete it (presumed it was removed)
    // //   if (!tags.filter((t) => !!t._id).includes(tag._id)) {
    // //     console.log("Deleting tag");
    // //     tag.isDeleted = true;
    // //     await tag.save();
    // //     allTags.filter((t) => !t._id.equals(tag._id));
    // //   }
    // // }

    // Update refDoc
    refDoc.tags = allTags.map((t) => t._id);
    await refDoc.save();
  } catch (err) {
    throw err;
  }
}

async function getUpsertedAssetTagKey(
  existingKeys: AssetTagKeyInterface[],
  tag: AssetTagInterface
): Promise<string> {
  /**
   * If key is ObjectId, find where tag.key === key._id (likely an existing tag)
   * If key is string, find where tag.key === key.title (likely a new tag)
   * If key is string and tag.framework is set, find where tag.key === key.title && tag.framework === key.framework
   */
  const key = existingKeys.find((k) =>
    isObjectIdOrHexString(tag.key)
      ? k._id.equals(tag.key)
      : k.title === tag.key.toString() &&
        (k.framework
          ? compareMongoIDs(
              k.framework,
              isAssetTagFrameworkObject(tag.framework)
                ? tag.framework._id
                : tag.framework
            )
          : true)
  );

  // If the key already exists, return it's ObjectId
  if (key) {
    return key._id.toString();
  }

  // If the key doesn't exist, create it and return it's ObjectId
  const newKey = new AssetTagKey({
    title: tag.key,
    hex: getRandomColor(),
    orgID: process.env.ORG_ID,
    framework: tag.framework,
  });
  await newKey.save();
  return newKey._id.toString();
}

function validateAssetTag(tag: AssetTagInterface): boolean {
  if (!tag.key) return false;
  if (!tag.value) return false;
  return true;
}

function validateAssetTagArray(tags: AssetTagInterface[]): boolean {
  for (const tag of tags) {
    if (!validateAssetTag(tag)) return false;
  }
  return true;
}

export { upsertAssetTags, validateAssetTag, validateAssetTagArray };
