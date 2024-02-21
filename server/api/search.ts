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
import { Request, Response } from "express";
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
import ProjectFile from "../models/projectfile.js";
import authAPI from "./auth.js";
import Author from "../models/author.js";

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

    let isSuperAdmin = false;

    if (req.user?.decoded?.uuid) {
      const user = await User.findOne({ uuid: req.user?.decoded?.uuid });
      if (user) {
        isSuperAdmin = authAPI.checkHasRole(
          user,
          "libretexts",
          "superadmin",
          true
        );
      }
    }

    const projectMatchObj = _generateProjectMatchObj({
      projLocation: req.query.location,
      projStatus: req.query.status,
      projClassification: req.query.classification,
      queryRegex,
      userUUID: req.user?.decoded.uuid,
      isSuperAdmin: isSuperAdmin,
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

    //Sort projects
    results.sort((a, b) => {
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

    const totalCount = results.length;
    const paginated = results.slice(
      projectsOffset,
      projectsOffset + projectsLimit
    );

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
    const booksOffset = getPaginationOffset(booksPage, booksLimit);

    const matchObj = _generateBookMatchObj({
      library: req.query.library,
      subject: req.query.subject,
      location: req.query.location,
      license: req.query.license,
      author: req.query.author,
      course: req.query.course,
      publisher: req.query.publisher,
      affiliation: req.query.affiliation,
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
      {
        $sort: {
          [req.query.sort]: 1,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(booksOffset, booksOffset + booksLimit);

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
    bookFilters.push({ library });
  }

  if (subject) {
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
  projClassification,
  queryRegex,
  userUUID,
  isSuperAdmin,
}: {
  projLocation?: string;
  projStatus?: string;
  projClassification?: string;
  queryRegex?: object;
  userUUID?: string;
  isSuperAdmin?: boolean;
}) {
  const projectFilters = [];
  let projectFiltersOptions = {};

  // If project location is not 'global', add it to the filters
  if (projLocation === "local") {
    projectFilters.push({ orgID: process.env.ORG_ID });
  }

  // If project classification is not 'any', add it to the filters
  if (projClassification && projClassification !== "any") {
    projectFilters.push({ classification: projClassification });
  }

  // If project status is not 'any', add it to the filters
  if (projStatus && projectAPI.projectStatusOptions.includes(projStatus)) {
    projectFilters.push({ status: projStatus });
  }

  // Generate visibility query
  let visibilityQuery = {};
  if (!isSuperAdmin) {
    // If user is not a super admin, add visibility query
    if (userUUID) {
      const teamMemberQuery =
        projectAPI.constructProjectTeamMemberQuery(userUUID);

      // If userUUID is provided, add query for private projects that the user is a member of
      const privateProjectQuery = {
        $and: [{ visibility: "private" }, { $or: teamMemberQuery }],
      };

      visibilityQuery = {
        $or: [privateProjectQuery, { visibility: "public" }],
      };
    } else {
      // If userUUID is not provided, only show public projects
      visibilityQuery = { visibility: "public" };
    }

    if (Object.keys(visibilityQuery).length > 0) {
      projectFilters.push(visibilityQuery);
    }
  }

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

    const mongoSearchQueryTerm = req.query.searchQuery ?? "";
    const assetsPage = parseInt(req.query.page?.toString()) || 1;
    const assetsLimit = parseInt(req.query.limit?.toString()) || 25;
    const assetsOffset = getPaginationOffset(assetsPage, assetsLimit);

    const searchQueryObj = _buildAssetsSearchQuery({
      query: mongoSearchQueryTerm,
      fileTypeFilter: req.query.fileType,
      licenseFilter: req.query.license,
      licenseVersionFilter: req.query.licenseVersion,
      strictMode: req.query.strictMode,
    });

    const matchObj = _buildFilesFilter({
      query: mongoSearchQueryTerm,
      fileTypeFilter: req.query.fileType,
      licenseFilter: req.query.license,
      licenseVersionFilter: req.query.licenseVersion,
      strictMode: req.query.strictMode,
    });

    const fromProjectFilesPromise = ProjectFile.aggregate([
      ...(Object.keys(searchQueryObj).length > 0
        ? [
            { $search: searchQueryObj },
            {
              $addFields: {
                score: { $meta: "searchScore" },
              },
            },
          ]
        : []),
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
      {
        $lookup: {
          from: "projects",
          let: {
            searchID: "$projectID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$projectID", "$$searchID"],
                },
                visibility: "public",
                orgID: process.env.ORG_ID,
              },
            },
            {
              $project: {
                title: 1,
                thumbnail: 1,
                associatedOrgs: 1,
              },
            },
          ],
          as: "projectInfo",
        },
      },
      {
        $set: {
          projectInfo: {
            $arrayElemAt: ["$projectInfo", 0],
          },
        },
      },
      {
        $match: {
          // Filter where project was not public or does not exist, so projectInfo wasn't set
          projectInfo: {
            $exists: true,
            $ne: [null, {}],
          },
        },
      },
      {
        $match: matchObj,
      },
      ...(Object.keys(searchQueryObj).length > 0
        ? [
            {
              $match: {
                score: {
                  $gte: 2,
                },
              },
            },
          ]
        : []),
    ]);

    const fromAssetTagsPromise = AssetTag.aggregate([
      {
        $search: {
          text: {
            query: mongoSearchQueryTerm,
            path: "value",
            fuzzy: {
              maxEdits: 2,
              maxExpansions: 50,
            },
          },
        },
      },
      {
        $addFields: {
          score: { $meta: "searchScore" },
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          localField: "_id",
          foreignField: "tags",
          as: "matchingProjectFiles",
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "matchingProjectFiles.projectID",
          foreignField: "projectID",
          as: "projectInfo",
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectInfo: {
                  $arrayElemAt: ["$projectInfo", 0],
                },
              },
              "$matchingProjectFiles",
              { score: "$score" },
            ],
          },
        },
      },
      {
        $match: {
          "projectInfo.visibility": "public",
        },
      },
      {
        $project: {
          projectInfo: {
            _id: 0,
            projectID: 0,
            orgID: 0,
            status: 0,
            visibility: 0,
            currentProgress: 0,
            peerProgress: 0,
            a11yProgress: 0,
            leads: 0,
            liaisons: 0,
            members: 0,
            auditors: 0,
            tags: 0,
            allowAnonPR: 0,
            cidDescriptors: 0,
            a11yReview: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
            adaptCourseID: 0,
            adaptURL: 0,
            classification: 0,
            defaultFileLicense: 0,
            libreCampus: 0,
            libreLibrary: 0,
            libreShelf: 0,
            projectURL: 0,
            didCreateWorkbench: 0,
            didMigrateWorkbench: 0,
          },
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
      {
        $match: matchObj,
      },
      {
        $match: {
          score: {
            $gte: 1.5,
          },
        },
      },
    ]);

    const fromAuthorsPromise = Author.aggregate([
      {
        $search: {
          text: {
            query: mongoSearchQueryTerm,
            path: ["firstName", "lastName", "email"],
            fuzzy: {
              maxEdits: 2,
              maxExpansions: 50,
            },
            score: { boost: { value: 1.5 } },
          },
        },
      },
      {
        $addFields: {
          score: { $meta: "searchScore" },
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          localField: "_id",
          foreignField: "authors",
          as: "matchingProjectFiles",
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "matchingProjectFiles.projectID",
          foreignField: "projectID",
          as: "projectInfo",
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectInfo: {
                  $arrayElemAt: ["$projectInfo", 0],
                },
              },
              "$matchingProjectFiles",
              { score: "$score" },
            ],
          },
        },
      },
      {
        $match: {
          "projectInfo.visibility": "public",
        },
      },
      {
        $project: {
          projectInfo: {
            _id: 0,
            projectID: 0,
            orgID: 0,
            status: 0,
            visibility: 0,
            currentProgress: 0,
            peerProgress: 0,
            a11yProgress: 0,
            leads: 0,
            liaisons: 0,
            members: 0,
            auditors: 0,
            tags: 0,
            allowAnonPR: 0,
            cidDescriptors: 0,
            a11yReview: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
            adaptCourseID: 0,
            adaptURL: 0,
            classification: 0,
            defaultFileLicense: 0,
            libreCampus: 0,
            libreLibrary: 0,
            libreShelf: 0,
            projectURL: 0,
            didCreateWorkbench: 0,
            didMigrateWorkbench: 0,
          },
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
      {
        $match: matchObj,
      },
      {
        $match: {
          score: {
            $gte: 0.5,
          },
        },
      },
    ]);

    const aggregations = [fromProjectFilesPromise];
    if (mongoSearchQueryTerm) {
      aggregations.push(fromAssetTagsPromise);
      aggregations.push(fromAuthorsPromise);
    }

    const aggregateResults = await Promise.all(aggregations);

    let allResults: any[] = [];
    // Merge files from text search and files from tags
    allResults = aggregateResults.flat().filter((file) => {
      // Remove files that don't have a projectID
      return file.projectID && file.fileID;
    });

    // Filter by org if provided
    if (req.query.org) {
      allResults = allResults.filter((file) => {
        return file.projectInfo.associatedOrgs?.includes(req.query.org);
      });
    }

    // Remove duplicate files
    const fileIDs = allResults.map((file: ProjectFileInterface) => file.fileID);
    const withoutDuplicates = Array.from(new Set(fileIDs)).map((fileID) => {
      return allResults.find(
        (file: ProjectFileInterface) => file.fileID === fileID
      );
    });

    const totalCount = withoutDuplicates.length;

    const paginated = withoutDuplicates.slice(
      assetsOffset,
      assetsOffset + assetsLimit
    );

    res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
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
  query?: string;
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
  strictMode?: boolean;
}) {
  const andQuery: Record<string, any>[] = [
    {
      access: "public",
    },
    {
      storageType: "file",
    },
  ];

  // If query is not provided, return like strict mode
  if (strictMode || !query) {
    if (fileTypeFilter) {
      const isWildCard = fileTypeFilter.includes("*");
      const parsedFileFilter = isWildCard
        ? fileTypeFilter.split("/")[0]
        : fileTypeFilter; // if mime type is wildcard, only use the first part of the mime type

      const wildCardRegex = {
        $regex: parsedFileFilter,
        $options: "i",
      };
      andQuery.push({
        mimeType: isWildCard ? wildCardRegex : parsedFileFilter,
      });
    }

    if (licenseFilter) {
      andQuery.push({
        "license.name": licenseFilter,
      });
    }

    if (licenseVersionFilter) {
      andQuery.push({
        "license.version": licenseVersionFilter,
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
  query?: string;
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
  strictMode?: boolean;
}) {
  const baseQuery: Record<any, any> = {
    ...(query && {
      text: {
        query,
        path: ["name", "description"],
        fuzzy: {
          maxEdits: 2,
          maxExpansions: 50,
        },
        score: { boost: { value: 2 } },
      },
    }),
  };

  return baseQuery;

  // if (!fileTypeFilter && !licenseFilter) {
  //   return baseQuery;
  // }

  // const compoundQueries = [];

  // if (Object.keys(baseQuery).length > 0) {
  //   compoundQueries.push(baseQuery);
  // }

  // if (fileTypeFilter) {
  //   const isWildCard = fileTypeFilter.includes("*");
  //   const parsedFileFilter = isWildCard
  //     ? fileTypeFilter.split("/")[0]
  //     : fileTypeFilter; // if mime type is wildcard, only use the first part of the mime type
  //   compoundQueries.push({
  //     text: {
  //       path: "mimeType",
  //       query: parsedFileFilter,
  //     },
  //   });
  // }

  // if (licenseFilter) {
  //   compoundQueries.push({
  //     text: {
  //       path: "license.name",
  //       query: licenseFilter,
  //     },
  //   });
  // }

  // const compoundQueryObj =
  //   strictMode === true
  //     ? { must: [...compoundQueries] }
  //     : { should: [...compoundQueries] };

  // // Build compound query
  // return {
  //   compound: compoundQueryObj,
  // };
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

async function getAssetFilterOptions(req: Request, res: Response) {
  try {
    const aggregations = [];

    const licensePromise = ProjectFile.aggregate([
      {
        $match: {
          "license.name": {
            $ne: "",
          },
        },
      },
      {
        $group: {
          _id: null,
          uniqueLicenseNames: {
            $addToSet: "$license.name",
          },
        },
      },
      {
        $project: {
          _id: 0,
          uniqueLicenseNames: 1,
        },
      },
    ]);

    aggregations.push(licensePromise);

    const fileTypePromise = ProjectFile.aggregate([
      { $match: { mimeType: { $exists: true, $ne: "" } } },
      { $group: { _id: "$mimeType" } },
    ]);
    aggregations.push(fileTypePromise);

    const orgsPromise = Project.aggregate([
      {
        $group: {
          _id: null,
          associatedOrgs: {
            $addToSet: "$associatedOrgs",
          },
        },
      },
      {
        $unwind: "$associatedOrgs",
      },
      {
        $unwind: "$associatedOrgs",
      },
      {
        $group: {
          _id: null,
          associatedOrgs: {
            $addToSet: "$associatedOrgs",
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);
    aggregations.push(orgsPromise);

    const results = await Promise.all(aggregations);
    const licenseNames = results[0][0]?.uniqueLicenseNames ?? [];
    const rawfileTypes = results[1] ?? [];
    const fileTypes = rawfileTypes.map((type: any) => type._id);
    const orgs = results[2][0]?.associatedOrgs ?? [];

    // Sort results
    licenseNames.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    fileTypes.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    orgs.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return res.send({
      err: false,
      licenses: licenseNames,
      fileTypes: fileTypes,
      orgs: orgs,
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
  getAssetFilterOptions,
};
