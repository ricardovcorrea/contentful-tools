import { getContentfulManagementEntries } from ".";
import { withCache } from "./cache";

export const getOpcoPages = (opcoId: string) =>
  withCache(`opco-pages:${opcoId}`, () =>
    getContentfulManagementEntries({
      content_type: "page",
      "fields.opco.fields.id": opcoId.toLowerCase(),
      "fields.opco.sys.contentType.sys.id": "opco",
    }).then((r) => ({
      ...r,
      items: r.items.filter((i) => i.fields.partner === undefined),
    })),
  );
