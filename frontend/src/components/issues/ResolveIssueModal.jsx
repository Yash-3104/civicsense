import { useEffect, useState } from "react";

import {
  X,
  CheckCircle2,
  Upload,
} from "lucide-react";

import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { toast } from "sonner";
import API from "@/services/api";

export default function ResolveIssueModal({
  issue,
  open,
  onClose,
}) {
  const queryClient = useQueryClient();

  const [resolutionNotes, setResolutionNotes] =
    useState("");

  const [image, setImage] =
    useState(null);

  const [previewUrl, setPreviewUrl] =
    useState(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const resetModal = () => {
    setResolutionNotes("");
    setImage(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
  };

  const handleClose = () => {
    if (resolveMutation.isPending) {
      return;
    }

    resetModal();
    onClose?.();
  };

  const handleImageChange = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setImage(file);

    setPreviewUrl(
      URL.createObjectURL(file)
    );
  };

  const resolveMutation =
    useMutation({
      mutationFn: async () => {
        if (!issue?.id) {
          throw new Error(
            "Issue ID is missing"
          );
        }

        const formData =
          new FormData();

        formData.append(
          "resolutionNotes",
          resolutionNotes
        );

        if (image) {
          formData.append(
            "image",
            image
          );
        }

        const response = await API.patch(
          `/api/issues/${issue.id}/resolve`,
          formData
        );

        return response.data;
      },

      onSuccess: () => {
        toast.success(
          "Resolution evidence submitted for admin review"
        );

        queryClient.invalidateQueries({
          queryKey: ["issues"],
        });

        queryClient.invalidateQueries({
          queryKey: ["nearby-issues"],
        });

        queryClient.invalidateQueries({
          queryKey: ["worker-issues"],
          exact: false,
        });

        queryClient.invalidateQueries({
          queryKey: ["issue-detail"],
          exact: false,
        });

        if (issue?.id) {
          queryClient.invalidateQueries({
            queryKey: [
              "admin-issue-detail",
              issue.id,
            ],
          });
        }

        resetModal();
        onClose?.();
      },

      onError: (error) => {
        console.error(
          "Failed to resolve issue",
          error
        );

        toast.error(
          error?.response?.data?.message ||
            error?.response?.data ||
            "Failed to resolve issue"
        );
      },
    });

  if (!open || !issue) {
    return null;
  }

  return (
    <div
      className="
        fixed
        inset-0
        z-[1400]
        flex
        items-center
        justify-center
        bg-black/70
        px-4
        py-6
        backdrop-blur-sm
      "
    >
      <div
        className="
          flex
          max-h-[90vh]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden
          rounded-3xl
          border
          border-zinc-800
          bg-zinc-950
          shadow-2xl
        "
      >
        <div
          className="
            shrink-0
            border-b
            border-zinc-800
            px-6
            py-5
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              gap-4
            "
          >
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2
                  className="
                    h-5
                    w-5
                    text-green-400
                  "
                />

                <p
                  className="
                    text-sm
                    font-medium
                    text-green-400
                  "
                >
                  Closure Review Workflow
                </p>
              </div>

              <h2
                className="
                  text-2xl
                  font-bold
                  text-white
                "
              >
                Submit Closure Evidence
              </h2>
            </div>

            <button
              type="button"
              onClick={handleClose}
              disabled={
                resolveMutation.isPending
              }
              className="
                rounded-xl
                border
                border-zinc-700
                p-2
                text-zinc-300
                transition
                hover:bg-zinc-800
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div
          className="
            min-h-0
            flex-1
            space-y-6
            overflow-y-auto
            p-6
          "
        >
          <div
            className="
              rounded-2xl
              border
              border-zinc-800
              bg-zinc-900
              p-5
            "
          >
            <h3
              className="
                mb-2
                text-lg
                font-semibold
                text-white
              "
            >
              {issue.title}
            </h3>

            <p className="text-sm text-zinc-400">
              {issue.category}
            </p>
          </div>

          <div>
            <label
              htmlFor="resolutionNotes"
              className="
                mb-2
                block
                text-sm
                font-medium
                text-zinc-300
              "
            >
              Worker Resolution Notes
            </label>

            <textarea
              id="resolutionNotes"
              rows={5}
              value={resolutionNotes}
              onChange={(e) =>
                setResolutionNotes(
                  e.target.value
                )
              }
              placeholder="Describe the repair/work completed. Admin will verify before final closure..."
              className="
                w-full
                resize-none
                rounded-2xl
                border
                border-zinc-700
                bg-zinc-900
                px-4
                py-3
                text-white
                outline-none
                transition
                placeholder:text-zinc-500
                focus:border-blue-500
              "
            />
          </div>

          <div>
            <label
              className="
                mb-2
                block
                text-sm
                font-medium
                text-zinc-300
              "
            >
              Closure Evidence Image
            </label>

            <label
              className="
                flex
                cursor-pointer
                flex-col
                items-center
                justify-center
                rounded-2xl
                border
                border-dashed
                border-zinc-700
                bg-zinc-900
                p-8
                transition
                hover:border-zinc-500
              "
            >
              <Upload
                className="
                  mb-3
                  h-8
                  w-8
                  text-zinc-500
                "
              />

              <p className="text-sm text-zinc-400">
                Upload AFTER image
              </p>

              {image && (
                <p className="mt-2 max-w-full truncate text-xs text-zinc-500">
                  Selected: {image.name}
                </p>
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </label>

            {previewUrl && (
              <div
                className="
                  mt-4
                  overflow-hidden
                  rounded-2xl
                  border
                  border-zinc-800
                  bg-black
                "
              >
                <img
                  src={previewUrl}
                  alt="Resolution preview"
                  className="
                    max-h-[240px]
                    w-full
                    object-contain
                  "
                />
              </div>
            )}
          </div>
        </div>

        <div
          className="
            shrink-0
            border-t
            border-zinc-800
            bg-zinc-950
            px-6
            py-5
          "
        >
          <div
            className="
              flex
              justify-end
              gap-3
            "
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={
                resolveMutation.isPending
              }
              className="
                rounded-xl
                border
                border-zinc-700
                px-5
                py-3
                font-medium
                text-zinc-200
                transition
                hover:bg-zinc-800
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={
                resolveMutation.isPending
              }
              onClick={() =>
                resolveMutation.mutate()
              }
              className="
                rounded-xl
                bg-green-600
                px-5
                py-3
                font-medium
                text-white
                transition
                hover:bg-green-500
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {resolveMutation.isPending
                ? "Resolving..."
                : "Submit Closure Evidence"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
