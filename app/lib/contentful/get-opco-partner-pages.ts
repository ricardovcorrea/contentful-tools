import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoPartnerPages = (opcoId: string, partnerId: string) =>
  withCache(`partner-pages:${opcoId}:${partnerId}`, () =>
    getContentfulManagementEntries({
      content_type: "page",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
    }),
  );
