import Promise from "bluebird";
import User from "../models/user.js";
import Project from "../models/project.js";
import Book from "../models/book.js";
import Homework from "../models/homework.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { getPaginationOffset, isValidDateObject } from "../util/helpers.js";
import projectAPI from "./projects.js";
import { ZodReqWithOptionalUser } from "../types/Express.js";
import { Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { ProjectFileInterface } from "../models/projectfile.js";
import { string, z } from "zod";
import AssetTag from "../models/assettag.js";
import { getSchemaWithDefaults } from "../util/typeHelpers.js";
import {
  assetSearchSchema,
  autocompleteSchema,
  bookSearchSchema,
  homeworkSearchSchema,
  projectSearchSchema,
  userSearchSchema,
} from "./validators/search.js";

/**
 * Performs a global search across multiple Conductor resource types (e.g. Projects, Books, etc.)
 */
async function projectsSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof projectSearchSchema>>,
  res: Response
) {
  try {
    //req = getSchemaWithDefaults(req, projectSearchSchema);

    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
          $regex: query,
          $options: "i",
        }
      : undefined;

    // Get pagination offsets
    const projectsPage = parseInt(req.query.page?.toString()) || 1;
    const projectsLimit = parseInt(req.query.limit?.toString()) || 25;
    const projectsOffset = getPaginationOffset(projectsPage, req.query.limit);

    const projectMatchObj = _generateProjectMatchObj({
      projLocation: req.query.location || undefined,
      projStatus: req.query.status || undefined,
      projVisibility: req.query.visibility || undefined,
      queryRegex,
      userUUID: req.user?.decoded.uuid || undefined,
    });

    const results = await Project.aggregate([
      {
        $match: projectMatchObj,
      },
      {
        $lookup: {
          from: "users",
          let: {
            leads: "$leads",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$uuid", "$$leads"],
                },
              },
            },
            {
              $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
                avatar: 1,
              },
            },
          ],
          as: "leads",
        },
      },
      {
        $project: {
          _id: 0,
          orgID: 1,
          projectID: 1,
          title: 1,
          status: 1,
          visibility: 1,
          currentProgress: 1,
          peerProgress: 1,
          a11yProgress: 1,
          classification: 1,
          leads: 1,
          author: 1,
          thumbnail: 1,
          updatedAt: 1,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      projectsOffset,
      projectsOffset + projectsLimit
    );

    //Sort projects
    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "title") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.sort === "classification") {
        aData = _transformToCompare(a.classification);
        bData = _transformToCompare(b.classification);
      } else if (req.query.sort === "visibility") {
        aData = _transformToCompare(a.visibility);
        bData = _transformToCompare(b.visibility);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function booksSearch(
  req: z.infer<typeof bookSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
          $regex: query,
          $options: "i",
        }
      : undefined;

    const booksPage = parseInt(req.query.page?.toString()) || 1;
    const booksLimit = parseInt(req.query.limit?.toString()) || 25;
    const booksOffset = getPaginationOffset(booksPage, req.query.limit);

    const matchObj = _generateBookMatchObj({
      library: req.query.library || undefined,
      subject: req.query.subject || undefined,
      location: req.query.location || undefined,
      license: req.query.license || undefined,
      author: req.query.author || undefined,
      course: req.query.course || undefined,
      publisher: req.query.publisher || undefined,
      affiliation: req.query.affiliation || undefined,
      queryRegex: queryRegex,
    });

    const results = await Book.aggregate([
      {
        $match: matchObj,
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(booksOffset, booksOffset + booksLimit);

    // Does this need to happen before paginating?
    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "title") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.sort === "author") {
        aData = _transformToCompare(a.author);
        bData = _transformToCompare(b.author);
      } else if (req.query.sort === "library") {
        aData = _transformToCompare(a.library);
        bData = _transformToCompare(b.library);
      } else if (req.query.sort === "subject") {
        aData = _transformToCompare(a.subject);
        bData = _transformToCompare(b.subject);
      } else if (req.query.sort === "affiliation") {
        aData = _transformToCompare(a.affiliation);
        bData = _transformToCompare(b.affiliation);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _generateBookMatchObj({
  library,
  subject,
  location,
  license,
  author,
  course,
  publisher,
  affiliation,
  queryRegex,
}: {
  library?: string;
  subject?: string;
  location?: "campus" | "central";
  license?: string;
  author?: string;
  course?: string;
  publisher?: string;
  affiliation?: string;
  queryRegex?: object;
}) {
  const bookFilters = [];
  let bookFiltersOptions = {};

  if (library) {
    bookFilters.push({ libreLibrary: library });
  }

  if (subject) {
    console.log("subject: ", subject);
    bookFilters.push({ subject });
  }

  if (location) {
    bookFilters.push({ location });
  }

  if (license) {
    bookFilters.push({ license });
  }

  if (author) {
    bookFilters.push({ author });
  }

  if (course) {
    bookFilters.push({ course });
  }

  if (publisher) {
    bookFilters.push({ program: publisher });
  }

  if (affiliation) {
    bookFilters.push({ affiliation });
  }

  // If multiple filters, use $and, otherwise just use the filter
  if (bookFilters.length > 1) {
    bookFiltersOptions = { $and: bookFilters };
  } else {
    bookFiltersOptions = { ...bookFilters[0] };
  }

  // Combine all filters and return
  const bookMatchOptions = {
    $and: [
      {
        ...bookFiltersOptions,
      },
    ],
  };

  if (queryRegex) {
    bookMatchOptions.$and.push({
      $or: [
        { title: queryRegex },
        { author: queryRegex },
        { course: queryRegex },
      ],
    });
  }

  return bookMatchOptions;
}

function _generateProjectMatchObj({
  projLocation,
  projStatus,
  projVisibility,
  queryRegex,
  userUUID,
}: {
  projLocation?: string;
  projStatus?: string;
  projVisibility?: "public" | "private";
  queryRegex?: object;
  userUUID?: string;
}) {
  const projectFilters = [];
  let projectFiltersOptions = {};

  // If project location is not 'any', add it to the filters
  if (projLocation === "local") {
    projectFilters.push({ orgID: process.env.ORG_ID });
  }

  // If project status is not 'any', add it to the filters
  if (projStatus && projectAPI.projectStatusOptions.includes(projStatus)) {
    projectFilters.push({ status: projStatus });
  }

  // Generate visibility query
  let visibilityQuery = {};
  // if (origin === "conductor" && userUUID && projVisibility === "private") {
  //   const teamMemberQuery =
  //     projectAPI.constructProjectTeamMemberQuery(userUUID);

  //   const privateProjectQuery = {
  //     $and: [{ visibility: "private" }, { $or: teamMemberQuery }],
  //   };

  //   visibilityQuery = {
  //     ...privateProjectQuery,
  //   };
  // } else {
  //   visibilityQuery = { visibility: "public" };
  // }
  // projectFilters.push(visibilityQuery);
  projectFilters.push({ visibility: "public" }); // TODO: handle showing private projects when logged in

  // If multiple filters, use $and, otherwise just use the filter
  if (projectFilters.length > 1) {
    projectFiltersOptions = { $and: projectFilters };
  } else {
    projectFiltersOptions = { ...projectFilters[0] };
  }

  // Combine all filters and return
  const projectMatchOptions = {
    $and: [
      {
        $or: [
          { title: queryRegex },
          { author: queryRegex },
          { libreLibrary: queryRegex },
          { libreCoverID: queryRegex },
          { libreShelf: queryRegex },
          { libreCampus: queryRegex },
          { associatedOrgs: queryRegex },
        ],
      },
      {
        ...projectFiltersOptions,
      },
    ],
  };
  return projectMatchOptions;
}

export async function assetsSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof assetSearchSchema>>,
  res: Response
) {
  try {
    //req.query = getSchemaWithDefaults(req.query, conductorSearchQuerySchema);

    const mongoSearchQueryTerm = req.query.searchQuery;
    const assetsPage = parseInt(req.query.page?.toString()) || 1;
    const assetsLimit = parseInt(req.query.limit?.toString()) || 25;
    const assetsOffset = getPaginationOffset(assetsPage, req.query.limit);

    const searchQueryObj = mongoSearchQueryTerm
      ? _buildAssetsSearchQuery({
          query: mongoSearchQueryTerm,
          fileTypeFilter: req.query.fileType || undefined,
          licenseFilter: req.query.license || undefined,
          licenseVersionFilter: req.query.licenseVersion || undefined,
          strictMode: req.query.strictMode || false,
        })
      : undefined;

    const matchObj = _buildFilesFilter({
      query: mongoSearchQueryTerm || "",
      fileTypeFilter: req.query.fileType || undefined,
      licenseFilter: req.query.license || undefined,
      licenseVersionFilter: req.query.licenseVersion || undefined,
      strictMode: req.query.strictMode || false,
    });

    const pipeline = [];

    if (searchQueryObj) {
      pipeline.push({
        $search: searchQueryObj,
      });
    }

    pipeline.push(
      // {
      //   $project: {
      //     files: 1,
      //     projectID: 1,
      //     title: 1,
      //     source: 1,
      //     thumbnail: 1,
      //     score: {
      //       $meta: "searchScore",
      //     },
      //   },
      // }
      {
        $match: {
          $and: [
            {
              access: "public",
            },
            {
              storageType: "file",
            },
          ],
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "tags",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assettagframeworks",
                localField: "framework",
                foreignField: "_id",
                pipeline: [
                  // Go through each template in framework and lookup key
                  {
                    $unwind: {
                      path: "$templates",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $lookup: {
                      from: "assettagkeys",
                      let: {
                        key: "$templates.key",
                      },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $eq: ["$_id", "$$key"],
                            },
                          },
                        },
                      ],
                      as: "key",
                    },
                  },
                  {
                    $set: {
                      "templates.key": {
                        $arrayElemAt: ["$key", 0],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      uuid: {
                        $first: "$uuid",
                      },
                      name: {
                        $first: "$name",
                      },
                      description: {
                        $first: "$description",
                      },
                      enabled: {
                        $first: "$enabled",
                      },
                      orgID: {
                        $first: "$orgID",
                      },
                      templates: {
                        $push: "$templates",
                      },
                    },
                  },
                ],
                as: "framework",
              },
            },
            {
              $set: {
                framework: {
                  $arrayElemAt: ["$framework", 0],
                },
              },
            },
            {
              $lookup: {
                from: "assettagkeys",
                localField: "key",
                foreignField: "_id",
                as: "key",
              },
            },
            {
              $set: {
                key: {
                  $arrayElemAt: ["$key", 0],
                },
              },
            },
          ],
          as: "tags",
        },
      }
    );
    const fromProjectsPromise = Project.aggregate(pipeline);

    const fromAssetTagsPromise = AssetTag.aggregate([
      {
        $search: {
          text: {
            query: mongoSearchQueryTerm,
            path: "value",
          },
        },
      },
      {
        $lookup: {
          from: "fileassettags",
          localField: "_id",
          foreignField: "tags",
          as: "matchingFileAssetTags",
        },
      },
      {
        $lookup: {
          from: "projects",
          as: "matchingProjectFiles",
          let: {
            fileIDs: "$matchingFileAssetTags.fileID",
          },
          pipeline: [
            {
              $match: {
                visibility: "public",
              },
            },
            {
              $match: matchObj,
            },
            {
              $unwind: {
                path: "$files",
              },
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: [
                    {
                      projectID: "$projectID",
                    },
                    {
                      projectTitle: "$title",
                    },
                    {
                      projectThumbnail: "$thumbnail",
                    },
                    "$files",
                  ],
                },
              },
            },
            {
              $match: {
                $and: [
                  {
                    access: "public",
                  },
                  {
                    $expr: {
                      $in: ["$_id", "$$fileIDs"],
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
        },
      },
      {
        $replaceRoot: {
          newRoot: "$matchingProjectFiles",
        },
      },
      {
        $lookup: {
          from: "fileassettags",
          localField: "_id",
          foreignField: "fileID",
          as: "tags",
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "tags.tags",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assettagframeworks",
                localField: "framework",
                foreignField: "_id",
                pipeline: [
                  // Go through each template in framework and lookup key
                  {
                    $unwind: {
                      path: "$templates",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $lookup: {
                      from: "assettagkeys",
                      let: {
                        key: "$templates.key",
                      },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $eq: ["$_id", "$$key"],
                            },
                          },
                        },
                      ],
                      as: "key",
                    },
                  },
                  {
                    $set: {
                      "templates.key": {
                        $arrayElemAt: ["$key", 0],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      uuid: {
                        $first: "$uuid",
                      },
                      name: {
                        $first: "$name",
                      },
                      description: {
                        $first: "$description",
                      },
                      enabled: {
                        $first: "$enabled",
                      },
                      orgID: {
                        $first: "$orgID",
                      },
                      templates: {
                        $push: "$templates",
                      },
                    },
                  },
                ],
                as: "framework",
              },
            },
            {
              $set: {
                framework: {
                  $arrayElemAt: ["$framework", 0],
                },
              },
            },
            {
              $lookup: {
                from: "assettagkeys",
                localField: "key",
                foreignField: "_id",
                as: "key",
              },
            },
            {
              $set: {
                key: {
                  $arrayElemAt: ["$key", 0],
                },
              },
            },
          ],
          as: "tags",
        },
      },
    ]);

    const aggregations = [fromProjectsPromise];

    if (mongoSearchQueryTerm) {
      aggregations.push(fromAssetTagsPromise);
    }

    const aggregateResults = await Promise.all(aggregations);

    // Merge files from text search and files from tags
    const allResults = aggregateResults.flat().filter((file) => {
      // Remove files that don't have a projectID
      return file.projectID && file.fileID;
    });

    // Remove duplicate files
    const fileIDs = allResults.map((file: ProjectFileInterface) => file.fileID);
    const withoutDuplicates = Array.from(new Set(fileIDs)).map((fileID) => {
      return allResults.find(
        (file: ProjectFileInterface) => file.fileID === fileID
      );
    });

    const totalCount = withoutDuplicates.length;

    // 'Paginate' results since we can't use skip/limit since there are two aggregations
    // results.files = results.files.slice(
    //   assetsOffset,
    //   assetsOffset + assetsLimit
    // );

    res.send({
      err: false,
      numResults: totalCount,
      results: withoutDuplicates,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _buildFilesFilter({
  query,
  fileTypeFilter,
  licenseFilter,
  licenseVersionFilter,
  strictMode,
}: {
  query: string;
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
  strictMode?: boolean;
}) {
  const andQuery: Record<string, any>[] = [
    {
      "files.access": "public",
    },
    {
      "files.storageType": "file",
    },
  ];

  // If query is not provided, return like strict mode
  if (strictMode || !query) {
    if (fileTypeFilter) {
      const isWildCard = fileTypeFilter.includes("*");
      const parsedFileFilter = isWildCard
        ? fileTypeFilter.split("/")[0]
        : fileTypeFilter; // if mime type is wildcard, only use the first part of the mime type
      const wildCardRegex = isWildCard
        ? {
            $regex: query,
            $options: "i",
          }
        : undefined;
      andQuery.push({
        "files.mimeType": isWildCard ? wildCardRegex : parsedFileFilter,
      });
    }

    if (licenseFilter) {
      andQuery.push({
        "files.license.name": licenseFilter,
      });
    }

    if (licenseVersionFilter) {
      andQuery.push({
        "files.license.version": licenseVersionFilter,
      });
    }
  }

  return {
    $and: andQuery,
  };
}

function _buildAssetsSearchQuery({
  query,
  fileTypeFilter,
  licenseFilter,
  licenseVersionFilter,
  strictMode,
}: {
  query: string;
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
  strictMode?: boolean;
}) {
  const baseQuery: Record<any, any> = {
    embeddedDocument: {
      path: "files",
      operator: {
        text: {
          query,
          path: { wildcard: "files.*" },
        },
      },
    },
    scoreDetails: true,
  };

  if (
    strictMode ||
    (!fileTypeFilter && !licenseFilter && !licenseVersionFilter)
  ) {
    return baseQuery;
  }

  const compoundQueries = [];
  if (fileTypeFilter) {
    const isWildCard = fileTypeFilter.includes("*");
    const parsedFileFilter = isWildCard
      ? fileTypeFilter.split("/")[0]
      : fileTypeFilter; // if mime type is wildcard, only use the first part of the mime type
    compoundQueries.push({
      text: {
        path: "files.mimeType",
        query: parsedFileFilter,
      },
    });
  }

  if (licenseFilter) {
    compoundQueries.push({
      text: {
        path: "files.license.name",
        query: licenseFilter,
      },
    });
  }

  if (licenseVersionFilter) {
    compoundQueries.push({
      text: {
        path: "files.license.version",
        query: licenseVersionFilter,
      },
    });
  }

  // Build compound query
  baseQuery.embeddedDocument.operator = {
    compound: {
      should: [...compoundQueries],
    },
  };

  return baseQuery;
}

async function homeworkSearch(
  req: z.infer<typeof homeworkSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
          $regex: query,
          $options: "i",
        }
      : undefined;

    const homeworkPage = parseInt(req.query.page?.toString()) || 1;
    const homeworkLimit = parseInt(req.query.limit?.toString()) || 25;
    const homeworkOffset = getPaginationOffset(homeworkPage, req.query.limit);

    const results = await Homework.aggregate([
      {
        $match: {
          $or: [
            { title: queryRegex },
            { kind: queryRegex },
            { description: queryRegex },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      homeworkOffset,
      homeworkOffset + homeworkLimit
    );

    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "name") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.sort === "description") {
        aData = _transformToCompare(a.description);
        bData = _transformToCompare(b.description);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function usersSearch(
  req: z.infer<typeof userSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
          $regex: query,
          $options: "i",
        }
      : undefined;

    const usersPage = parseInt(req.query.page?.toString()) || 1;
    const usersLimit = parseInt(req.query.limit?.toString()) || 25;
    const usersOffset = getPaginationOffset(usersPage, req.query.limit);

    const results = await User.aggregate([
      {
        $match: {
          $and: [
            {
              $or: [{ firstName: queryRegex }, { lastName: queryRegex }],
            },
            { $expr: { $not: "$isSystem" } },
          ],
        },
      },
      {
        $project: {
          _id: 0,
          uuid: 1,
          firstName: 1,
          lastName: 1,
          avatar: 1,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(usersOffset, usersOffset + usersLimit);

    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "first") {
        aData = _transformToCompare(a.firstName);
        bData = _transformToCompare(b.firstName);
      } else if (req.query.sort === "last") {
        aData = _transformToCompare(a.lastName);
        bData = _transformToCompare(b.lastName);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAutocompleteResults(
  req: z.infer<typeof autocompleteSchema>,
  res: Response
) {
  try {
    const query = req.query.query;
    const limit = req.query.limit || 5;

    const tagsResults = await AssetTag.aggregate([
      {
        $search: {
          index: "asset-tags-autocomplete",
          autocomplete: {
            query: query,
            path: "value",
            fuzzy: {
              maxEdits: 2,
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          value: 1,
        },
      },
      {
        $sort: {
          value: 1,
        },
      },
    ]).limit(limit);

    const values = tagsResults.map((tag) => tag.value);
    const reduced = values.reduce((acc, val) => {
      if (val instanceof Array) {
        val.forEach((v) => {
          acc.push(v);
        });
      } else {
        acc.push(val);
      }
      return acc;
    }, []);

    const uniqueValues = [...new Set<string>(reduced)];

    // Filter out values that are less than 3 characters
    const filtered = uniqueValues.filter((val) => {
      return val.length > 3;
    });

    return res.send({
      err: false,
      numResults: tagsResults.length,
      results: filtered,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _transformToCompare(val: any) {
  return String(val)
    .toLowerCase()
    .replace(/[^A-Za-z]+/g, "");
}

export default {
  assetsSearch,
  booksSearch,
  homeworkSearch,
  projectsSearch,
  usersSearch,
  getAutocompleteResults,
};
