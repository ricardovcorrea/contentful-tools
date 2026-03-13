import { getContentfulManagementClient } from ".";
import { withCache } from "./cache";

export const getLocales = () =>
  withCache("locales", async () => {
    const client = getContentfulManagementClient();
    const space = await client.getSpace(
      import.meta.env.VITE_CONTENTFUL_SPACE_ID,
    );
    const environment = await space.getEnvironment(
      import.meta.env.VITE_CONTENTFUL_ENVIRONMENT,
    );
    return environment.getLocales();
  });
