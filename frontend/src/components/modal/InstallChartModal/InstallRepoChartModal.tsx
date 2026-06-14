import { useMutation } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { useParams } from "react-router";

import { BsPencil, BsX } from "react-icons/bs";

import apiService from "../../../API/apiService";
import type { InstallChartModalProps } from "../../../data/types";
import useNavigateWithSearchParams from "../../../hooks/useNavigateWithSearchParams";
import { isNoneEmptyArray } from "../../../utils";
import Spinner from "../../Spinner";
import Modal, { ModalButtonStyle } from "../Modal";
import { GeneralDetails } from "./GeneralDetails";
import { InstallUpgradeTitle } from "./InstallUpgradeTitle";
import { VersionToInstall } from "./VersionToInstall";
import { useInstallUpgradeFlow } from "./useInstallUpgradeFlow";

const DefinedValues = lazy(() => import("./DefinedValues"));
const ManifestDiff = lazy(() => import("./ManifestDiff"));

export const InstallRepoChartModal = ({
  isOpen,
  onClose,
  chartName,
  currentlyInstalledChartVersion,
  urlMode: initialURLMode = false,
}: InstallChartModalProps & { urlMode?: boolean }) => {
  const navigate = useNavigateWithSearchParams();
  const { context, selectedRepo: currentRepoCtx } = useParams();

  const flow = useInstallUpgradeFlow({
    chartName,
    currentlyInstalledChartVersion,
    isUpgrade: false,
    isInstallRepoChart: true,
    initialURLMode,
    initialReleaseName: chartName,
    filterRepo: currentRepoCtx,
  });

  // Confirm method (install)
  const setReleaseVersionMutation = useMutation<{
    namespace: string;
    name: string;
  }>({
    mutationKey: [
      "setVersion",
      flow.namespace,
      flow.releaseName,
      flow.selectedVersion,
      flow.selectedRepo,
      context,
      flow.chartAddress,
    ],
    mutationFn: async () => {
      flow.setInstallError("");
      const formData = new FormData();
      formData.append("preview", "false");
      formData.append("chart", flow.chartAddress);
      formData.append("version", flow.selectedVersion || "");
      formData.append("values", flow.values);
      formData.append("name", flow.releaseName || "");

      return await apiService.fetchWithSafeDefaults({
        url: `/api/helm/releases/${flow.namespace ? flow.namespace : "default"}`,
        options: {
          method: "post",
          body: formData,
        },
        fallback: { namespace: "", name: "" },
      });
    },

    onSuccess: async (response: { namespace: string; name: string }) => {
      onClose();
      await navigate(
        `/${response.namespace}/${response.name}/installed/revision/1`
      );
    },
    onError: (error) => {
      flow.setInstallError(error?.message || "Failed to update");
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        initialURLMode ? (
          <div className="font-bold">Install from URL</div>
        ) : (
          <InstallUpgradeTitle
            isUpgrade={false}
            releaseValues={false}
            chartName={chartName}
          />
        )
      }
      containerClassNames="w-full text-2xl h-2/3"
      actions={[
        {
          id: "1",
          callback: setReleaseVersionMutation.mutate,
          variant: ModalButtonStyle.info,
          isLoading: setReleaseVersionMutation.isPending,
          disabled:
            flow.loadingChartValues ||
            flow.isLoadingDiff ||
            setReleaseVersionMutation.isPending,
        },
      ]}
    >
      {!flow.useURLMode && flow.versions && isNoneEmptyArray(flow.versions) ? (
        <div className="flex items-center gap-2">
          <VersionToInstall
            versions={flow.versions}
            initialVersion={flow.selectedVersionData}
            onSelectVersion={flow.setSelectedVersionData}
            showCurrentVersion={false}
          />
          <button
            type="button"
            className="cursor-pointer p-1 text-gray-400 hover:text-gray-600"
            title="Switch to URL"
            onClick={() => flow.setUseURLMode(true)}
          >
            <BsPencil className="text-lg" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <h4 className="text-lg">Chart URL:</h4>
            <input
              className="w-full rounded-sm border border-1 border-gray-300 bg-white px-2 py-1 text-lg"
              value={flow.chartURL}
              onChange={(e) => flow.setChartURL(e.target.value)}
              placeholder="oci://registry-1.docker.io/example/chart:1.0.0"
            />
          </div>
          {flow.versions && isNoneEmptyArray(flow.versions) && (
            <button
              type="button"
              className="cursor-pointer p-1 text-gray-400 hover:text-gray-600"
              title="Switch to repository"
              onClick={() => {
                flow.setUseURLMode(false);
                flow.setChartURL("");
              }}
            >
              <BsX className="text-2xl" />
            </button>
          )}
        </div>
      )}

      <GeneralDetails
        releaseName={flow.releaseName ?? ""}
        disabled={false}
        namespace={flow.namespace}
        onReleaseNameInput={flow.setReleaseName}
        onNamespaceInput={flow.setNamespace}
      />

      <DefinedValues
        value={flow.values}
        onUserValuesChange={flow.setValues}
        chartValues={flow.chartValues}
        loading={flow.loadingChartValues}
      />

      <Suspense fallback={<Spinner />}>
        <ManifestDiff
          diff={flow.diffData as string}
          isLoading={flow.isLoadingDiff}
          isFetching={flow.isFetchingDiff}
          error={flow.errorString}
        />
      </Suspense>
    </Modal>
  );
};
