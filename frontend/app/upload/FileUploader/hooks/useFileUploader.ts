/* eslint-disable max-lines */

import axios from "axios";
import { UUID } from "crypto";
import { useCallback, useState } from "react";
import { FileRejection, useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";

import { useUploadApi } from "@/lib/api/upload/useUploadApi";
import { useBrainContext } from "@/lib/context/BrainProvider/hooks/useBrainContext";
import { useSupabase } from "@/lib/context/SupabaseProvider";
import { useToast } from "@/lib/hooks";
import { redirectToLogin } from "@/lib/router/redirectToLogin";
import { useEventTracking } from "@/services/analytics/useEventTracking";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const useFileUploader = () => {
  const { track } = useEventTracking();
  const [isPending, setIsPending] = useState(false);
  const { publish } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const { session } = useSupabase();
  const { uploadFile } = useUploadApi();
  const { currentBrain } = useBrainContext();

  if (session === null) {
    redirectToLogin();
  }

  const { t } = useTranslation(["upload"]);

  const upload = useCallback(
    async (file: File, brainId: UUID) => {
      const formData = new FormData();
      formData.append("uploadFile", file);
      try {
        void track("FILE_UPLOADED");
        const response = await uploadFile({ brainId, formData });
        publish({
          variant: response.data.type,
          text:
            response.data.type === "success"
              ? t("success", { ns: "upload" })
              : t("error", { message: response.data.message, ns: "upload" }),
        });
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 403) {
          publish({
            variant: "danger",
            text: `${JSON.stringify(
              (
                e.response as {
                  data: { detail: string };
                }
              ).data.detail
            )}`,
          });
        } else {
          publish({
            variant: "danger",
            text: t("error", { message: e, ns: "upload" }),
          });
        }
      }
    },
    [publish, t, track, uploadFile]
  );

  const onDrop = (acceptedFiles: File[], fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      const firstRejection = fileRejections[0];

      if (firstRejection.errors[0].code === "file-invalid-type") {
        publish({ variant: "danger", text: t("invalidFileType") });
      } else {
        publish({
          variant: "danger",
          text: t("maxSizeError", { ns: "upload" }),
        });
      }

      return;
    }

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      const isAlreadyInFiles =
        files.filter((f) => f.name === file.name && f.size === file.size)
          .length > 0;
      if (isAlreadyInFiles) {
        publish({
          variant: "warning",
          text: t("alreadyAdded", { fileName: file.name, ns: "upload" }),
        });
        acceptedFiles.splice(i, 1);
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-shadow
    setFiles((files) => [...files, ...acceptedFiles]);
  };

  const uploadAllFiles = async () => {
    if (files.length === 0) {
      publish({
        text: t("addFiles", { ns: "upload" }),
        variant: "warning",
      });

      return;
    }
    setIsPending(true);
    if (currentBrain?.id !== undefined) {
      await Promise.all(files.map((file) => upload(file, currentBrain.id)));
      setFiles([]);
    } else {
      publish({
        text: t("selectBrain", { ns: "upload" }),
        variant: "warning",
      });
    }
    setIsPending(false);
  };

  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true,
    maxSize: 100000000, // 1 MB
    accept: {
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md", ".markdown"],
      "audio/x-m4a": [".m4a"],
      "audio/mpeg": [".mp3", ".mpga", ".mpeg"],
      "audio/webm": [".webm"],
      "video/mp4": [".mp4"],
      "audio/wav": [".wav"],
      "application/pdf": [".pdf"],
      "text/html": [".html"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        [".pptx"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "application/vnd.oasis.opendocument.text": [".odt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
        ".xls",
      ],
      "application/epub+zip": [".epub"],
      "application/x-ipynb+json": [".ipynb"],
      "text/x-python": [".py"],
    },
  });

  return {
    isPending,
    getInputProps,
    getRootProps,
    isDragActive,
    open,
    uploadAllFiles,
    files,
    setFiles,
  };
};
