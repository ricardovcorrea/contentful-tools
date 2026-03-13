import { getContentfulManagementClient } from ".";

export type ScheduledAction = {
  id: string;
  action: "publish" | "unpublish";
  entityId: string;
  entityType: string;
  scheduledAt: string;
  status: "scheduled" | "succeeded" | "failed" | "cancelled";
};

export async function getScheduledActions(
  spaceId: string,
  environmentId: string,
): Promise<ScheduledAction[]> {
  const client = getContentfulManagementClient();
  const space = await client.getSpace(spaceId);
  const result = await (space as any).getScheduledActions({
    "environment.sys.id": environmentId,
    "sys.status": "scheduled",
  });
  return (result.items ?? []).map((item: any) => ({
    id: item.sys.id,
    action: item.action,
    entityId: item.entity?.sys?.id ?? "",
    entityType: item.entity?.sys?.linkType ?? item.entity?.sys?.type ?? "Entry",
    scheduledAt: item.scheduledFor?.datetime ?? "",
    status: item.sys.status,
  }));
}
