import { getContentfulManagementClient } from ".";
import { withCache } from "./cache";

export const getCurrentUser = () =>
  withCache("current-user", () =>
    getContentfulManagementClient().getCurrentUser(),
  );
