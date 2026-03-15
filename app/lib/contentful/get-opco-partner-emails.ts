import { getContentfulManagementEntries } from ".";
import { queryClient, QUERY_STALE_TIME } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

export const getOpcoPartnerEmails = (opcoId: string, partnerId: string) =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.partnerEmails(opcoId, partnerId),
    queryFn: () =>
      getContentfulManagementEntries({
        content_type: "emailVoucherConfirmation",
        "fields.opco.fields.id": opcoId.toLowerCase(),
        "fields.opco.sys.contentType.sys.id": "opco",
        "fields.partner.fields.id": partnerId.toLowerCase(),
        "fields.partner.sys.contentType.sys.id": "partner",
      }),
    staleTime: QUERY_STALE_TIME,
  });
