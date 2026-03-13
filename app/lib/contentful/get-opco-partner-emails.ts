import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoPartnerEmails = (opcoId: string, partnerId: string) =>
  withCache(`partner-emails:${opcoId}:${partnerId}`, () =>
    getContentfulManagementEntries({
      content_type: "emailVoucherConfirmation",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
      "fields.partner.fields.id": partnerId.toLowerCase(),
      "fields.partner.sys.contentType.sys.id": "partner",
    }),
  );
