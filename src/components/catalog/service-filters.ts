export type ServiceVisibilityFilter = "all" | "active" | "hidden";

export function filterCatalogServices<T extends { active: boolean; professionalMemberIds: readonly string[] }>(
  services: readonly T[],
  visibility: ServiceVisibilityFilter,
  professionalId: string,
): T[] {
  return services.filter((service) => {
    if (visibility === "active" && !service.active) return false;
    if (visibility === "hidden" && service.active) return false;
    if (professionalId === "all") return true;
    if (professionalId === "none") return service.professionalMemberIds.length === 0;
    return service.professionalMemberIds.includes(professionalId);
  });
}
