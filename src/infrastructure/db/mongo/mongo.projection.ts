export const HIDE_MONGO_INTERNAL_FIELDS = { _id: 0, __v: 0 } as const;

export const HIDE_USER_INTERNAL_FIELDS = {
  ...HIDE_MONGO_INTERNAL_FIELDS,
  normalizedName: 0,
} as const;
