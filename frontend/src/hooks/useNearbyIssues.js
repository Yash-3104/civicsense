import { useQuery } from "@tanstack/react-query";
import API from "@/services/api";

const fetchNearbyIssues = async ({ queryKey }) => {
  const [_key, lat, lng, filter] = queryKey;

  const res = await API.get(
    `/api/issues/nearby?lat=${lat}&lng=${lng}&radius=5`
  );

  let data = res.data || [];

  if (filter.category) {
    data = data.filter(
      (issue) => issue.category === filter.category
    );
  }

  if (filter.severity) {
    data = data.filter(
      (issue) => issue.severity === filter.severity
    );
  }

  return data;
};

export function useNearbyIssues(lat, lng, filter) {
  return useQuery({
    queryKey: ["nearby-issues", lat, lng, filter],
    queryFn: fetchNearbyIssues,
    enabled: !!lat && !!lng,
  });
}