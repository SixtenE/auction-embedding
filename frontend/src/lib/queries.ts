import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { uploadImage, searchByImage, getImage, deleteImage } from "@/lib/api";

export function useUploadImage() {
  return useMutation({
    mutationFn: ({ file, tags }: { file: File; tags?: Record<string, unknown> }) =>
      uploadImage(file, tags),
  });
}

export function useSearchByImage() {
  return useMutation({
    mutationFn: ({ file, topK }: { file: File; topK?: number }) =>
      searchByImage(file, topK),
  });
}

export function useGetImage(id: string | null) {
  return useQuery({
    queryKey: ["image", id],
    queryFn: () => getImage(id!),
    enabled: !!id,
  });
}

export function useDeleteImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteImage(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["image", id] });
    },
  });
}
