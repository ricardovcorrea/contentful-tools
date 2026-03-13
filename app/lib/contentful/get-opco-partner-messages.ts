import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoPartnerMessages = (opcoId: string, partnerId: string) =>
  withCache(`partner-messages:${opcoId}:${partnerId}`, () =>
    getContentfulManagementEntries({
      content_type: "message",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
    }),
  );
