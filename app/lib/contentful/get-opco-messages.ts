import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getOpcoMessages = (opcoId: string) =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.opcoMessages(opcoId),
    queryFn: () =>
      getContentfulManagementEntries({
        content_type: "message",
        "fields.opco.fields.id": opcoId.toLowerCase(),
        "fields.opco.sys.contentType.sys.id": "opco",
      }).then((r) => ({
        ...r,
        items: r.items.filter((i) => i.fields.partner === undefined),
      })),
    staleTime: QUERY_STALE_TIME,
  });
