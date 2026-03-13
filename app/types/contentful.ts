// ── Shared Contentful data shapes ─────────────────────────────────────────

export type EntryGroup = {
  label: string;
  slug: string;
  items: any[];
};

export type RefGroup = {
  contentTypeId: string;
  label: string;
  slug: string;
  items: any[];
};

/** Shape of data returned by home.tsx's clientLoader, consumed by child routes */
export type ParentLoaderData = {
  opcos: { items: any[] };
  opcoId: string;
  opcoPartners: { items: any[] };
  partnerId: string;
  opcoPages: { items: any[] };
  opcoMessages: { items: any[] };
  partnerPages: { items: any[] };
  partnerMessages: { items: any[] };
  partnerEmails: { items: any[] };
  opcoRefGroups: RefGroup[];
  partnerRefGroups: RefGroup[];
  locales: { items: { code: string }[] };
  currentUser: {
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string;
  };
  spaceId: string;
  spaceName: string;
  environmentId: string;
  environmentName: string;
  environments: { id: string; name: string }[];
  localizableContentTypes: string[];
  cacheLastUpdated: number | null;
};

// ── Overview-specific types ────────────────────────────────────────────────

export type ApplyStatus = "pending" | "loading" | "success" | "error";

export type ApplyEntry = {
  entryId: string;
  entryName: string;
  fields: Record<string, Record<string, string>>;
  status: ApplyStatus;
  error?: string;
};

export type DiffChange = {
  old: string;
  new: string;
  enGB: string;
  kind: "added" | "changed";
};

export type DiffRow = {
  scope: string;
  group: string;
  entryName: string;
  entryId: string;
  field: string;
  changes: Record<string, DiffChange>;
};

export type EntryFieldDiffRow = {
  fieldId: string;
  locale: string;
  published: string;
  draft: string;
};

export type EntryDiffModalState = {
  entryId: string;
  entryName: string;
  loading: boolean;
  error: string | null;
  rows: EntryFieldDiffRow[];
} | null;

export type UnpublishedItem = {
  item: any;
  scope: string;
  group: string;
  groupLabel: string;
  status: "draft" | "changed";
};
