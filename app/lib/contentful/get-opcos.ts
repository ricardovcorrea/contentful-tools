import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcos = () =>
  withCache("opcos", () =>
    getContentfulManagementEntries({ content_type: "opco" }),
  );
