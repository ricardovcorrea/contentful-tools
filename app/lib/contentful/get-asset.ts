import { getContentfulManagementEnvironment } from ".";
import { withCache } from "./cache";

export const getAsset = (assetId: string) =>
  withCache(`asset:${assetId}`, async () => {
    const environment = await getContentfulManagementEnvironment();
    return environment.getAsset(assetId);
  });
