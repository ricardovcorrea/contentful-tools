import { getContentfulManagementEnvironment } from ".";
import { withCache } from "./cache";

export const getContentType = (contentTypeId: string) =>
  withCache(`content-type:${contentTypeId}`, async () => {
    const environment = await getContentfulManagementEnvironment();
    return environment.getContentType(contentTypeId);
  });
