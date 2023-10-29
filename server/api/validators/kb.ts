import { z } from "zod";

const KBUUIDParams = z.object({
  params: z.object({
    uuid: z.string().uuid(),
  }),
});

// KB Pages
export const GetKBPageValidator = z
  .object({
    params: z.object({
      uuid: z.string().uuid().optional(),
    }),
    query: z.object({
      path: z.string().optional(),
    }),
  })
  .refine((data) => {
    if (!data.params.uuid && !data.query.path) {
      throw new Error("Either uuid or path must be provided");
    }
    return true;
  });

export const DeleteKBPageValidator = KBUUIDParams;

export const CreateKBPageValidator = z.object({
  body: z.object({
    title: z.string(),
    description: z.string().max(200),
    body: z.string(),
    status: z.enum(["draft", "published"]),
    url: z.string().optional(),
    parent: z.string().uuid().optional(),
    lastEditedBy: z.string().uuid(),
  }),
});

export const UpdateKBPageValidator = KBUUIDParams.merge(CreateKBPageValidator);

// KB Tree
export const GetKBTreeValidator = z.object({
  params: z.object({
    uuid: z.string().uuid().optional(), // Optional here, if not provided, return root
  }),
});

// KB Featured Pages
export const CreateKBFeaturedPageValidator = z.object({
  body: z.object({
    page: z.string().uuid(),
  }),
});

export const DeleteKBFeaturedPageValidator = KBUUIDParams;

// KB Featured Videos
export const CreateKBFeaturedVideoValidator = z.object({
  body: z.object({
    title: z.string(),
    url: z.string().url(),
  }),
});

export const DeleteKBFeaturedVideoValidator = KBUUIDParams;
