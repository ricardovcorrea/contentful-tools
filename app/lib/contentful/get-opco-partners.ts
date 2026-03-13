import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoPartners = (opcoId: string) =>
  withCache(`opco-partners:${opcoId}`, () =>
    getContentfulManagementEntries({
      content_type: "partner",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
    }),
  );
