import { getContentfulManagementEnvironment } from ".";
import { withCache } from "./cache";

export const getEntry = (entryId: string) =>
  withCache(`entry:${entryId}`, async () => {
    const environment = await getContentfulManagementEnvironment();
    return environment.getEntry(entryId);
  });
