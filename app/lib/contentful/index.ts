import { createClient } from "contentful";
import type { ClientAPI, QueryOptions } from "contentful-management";
import * as contentfulManagement from "contentful-management";
import { clearCache } from "./cache";
import { queryClient } from "~/lib/query-client";
import { queryKeys } from "~/lib/query-keys";

let contentfulClient: ReturnType<typeof createClient>;
let contentfulManagementClient: ClientAPI;

const getStoredValue = (key: string): string => {
  const value = localStorage.getItem(key);
  if (!value) throw new Error(`Missing required value in localStorage: ${key}`);
  return value;
};

export const getContentfulClient = () => {
  if (contentfulClient) return contentfulClient;

  contentfulClient = createClient({
    space: getStoredValue("contentfulSpaceId"),
    accessToken: getStoredValue("contentfulAccessToken"),
    environment: getStoredValue("contentfulEnvironment"),
  });

  return contentfulClient;
};

export const getContentfulManagementClient = () => {
  if (contentfulManagementClient) return contentfulManagementClient;

  contentfulManagementClient = contentfulManagement.createClient({
    accessToken: getStoredValue("contentfulManagementToken"),
  });

  return contentfulManagementClient;
};

export const clearContentfulManagementClient = () => {
  contentfulManagementClient = undefined as unknown as ClientAPI;
  clearCache();
};

const resolveManagementEnvironment = async () => {
  const client = getContentfulManagementClient();
  const spaceId = getStoredValue("contentfulSpaceId");
  const environmentId = getStoredValue("contentfulEnvironment");
  const space = await client.getSpace(spaceId);
  return space.getEnvironment(environmentId);
};

const getManagementEnvironment = () =>
  queryClient.ensureQueryData({
    queryKey: queryKeys.managementEnvironment(),
    queryFn: resolveManagementEnvironment,
    staleTime: Infinity,
  });

export const getContentfulManagementEntries = async (query: QueryOptions) => {
  const environment = await getManagementEnvironment();
  return environment.getEntries(query);
};

export const getContentfulManagementEnvironment = getManagementEnvironment;
