import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

/** Returns every partner entry across all OPCOs. */
export const getAllPartners = () =>
  withCache("all-partners", () =>
    getContentfulManagementEntries({ content_type: "partner" }),
  );
