import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { useParams } from "react-router";

import { BsPencil, BsX } from "react-icons/bs";

import apiService from "../../../API/apiService";
import type { VersionData } from "../../../API/releases";
import type { InstallChartModalProps } from "../../../data/types";
import useNavigateWithSearchParams from "../../../hooks/useNavigateWithSearchParams";
import { isNoneEmptyArray } from "../../../utils";
import Spinner from "../../Spinner";
import Modal, { ModalButtonStyle } from "../Modal";
import { GeneralDetails } from "./GeneralDetails";
import { VersionToInstall } from "./VersionToInstall";
import { InstallUpgradeTitle } from "./InstallUpgradeTitle";
import { useInstallUpgradeFlow } from "./useInstallUpgradeFlow";

const DefinedValues = lazy(() => import("./DefinedValues"));
const ManifestDiff = lazy(() => import("./ManifestDiff"));

export const InstallReleaseChartModal = ({
  isOpen,
  onClose,
  chartName,
  currentlyInstalledChartVersion,
  isUpgrade = false,
  latestRevision,
}: InstallChartModalProps) => {
  const navigate = useNavigateWithSearchParams();
  const queryClient = useQueryClient();
  const {
    namespace: queryNamespace,
    chart: queryReleaseName,
    context,
  } = useParams();

  const flow = useInstallUpgradeFlow({
    chartName,
    currentlyInstalledChartVersion,
    isUpgrade: true,
    initialNamespace: queryNamespace || "",
    initialReleaseName: queryReleaseName || "",
    releaseNameForManifest: queryReleaseName || "",
    latestRevision,
  });

  const [forceUpgrade, setForceUpgrade] = useState(false);

  // Confirm method (install/upgrade)
  const setReleaseVersionMutation = useMutation<VersionData, Error>({
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
      if (flow.chartAddress) {
        formData.append("chart", flow.chartAddress);
      }
      formData.append("version", flow.selectedVersion || "");
      formData.append("values", flow.values || flow.releaseValues || "");
      if (forceUpgrade) {
        formData.append("force", "true");
      }
      const url = `/api/helm/releases/${
        flow.namespace ? flow.namespace : "default"
      }/${flow.releaseName}`;

      return await apiService.fetchWithSafeDefaults<VersionData>({
        url,
        options: {
          method: "post",
          body: formData,
        },
        fallback: { version: "", urls: [""] },
      });
    },
    onSuccess: async (response) => {
      onClose();
      // Invalidate all queries instead of window.location.reload()
      await queryClient.invalidateQueries();
      await navigate(
        `/${flow.namespace ? flow.namespace : "default"}/${
          flow.releaseName
        }/installed/revision/${response.version}`
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
        <InstallUpgradeTitle
          isUpgrade={isUpgrade}
          releaseValues={isUpgrade || !!flow.releaseValues}
          chartName={chartName}
        />
      }
      containerClassNames="w-full text-2xl h-2/3"
      bottomContent={
        isUpgrade ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={forceUpgrade}
              onChange={(e) => setForceUpgrade(e.target.checked)}
            />
            Force upgrade
          </label>
        ) : undefined
      }
      actions={[
        {
          id: "1",
          callback: setReleaseVersionMutation.mutate,
          variant: ModalButtonStyle.info,
          isLoading: setReleaseVersionMutation.isPending,
          disabled:
            flow.loadingReleaseValues ||
            flow.isLoadingDiff ||
            setReleaseVersionMutation.isPending,
        },
      ]}
    >
      {flow.isLoadingVersions ? (
        <Spinner />
      ) : !flow.useURLMode &&
        flow.versions &&
        isNoneEmptyArray(flow.versions) ? (
        <div className="flex items-center gap-2">
          <VersionToInstall
            versions={flow.versions}
            initialVersion={flow.selectedVersionData}
            onSelectVersion={flow.setSelectedVersionData}
            showCurrentVersion
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
              placeholder="oci://registry-1.docker.io/example/chart"
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
        releaseName={flow.releaseName}
        disabled
        namespace={flow.namespace ? flow.namespace : flow.filteredNamespace}
        onReleaseNameInput={flow.setReleaseName}
        onNamespaceInput={flow.setNamespace}
      />

      <Suspense fallback={<Spinner />}>
        <DefinedValues
          value={flow.values}
          onUserValuesChange={flow.setValues}
          chartValues={flow.chartValues}
          loading={flow.loadingReleaseValues}
        />
      </Suspense>

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
