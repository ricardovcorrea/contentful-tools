import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoMessages = (opcoId: string) =>
  withCache(`opco-messages:${opcoId}`, () =>
    getContentfulManagementEntries({
      content_type: "message",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
    }).then((r) => ({
      ...r,
      items: r.items.filter((i) => i.fields.partner === undefined),
    })),
  );
