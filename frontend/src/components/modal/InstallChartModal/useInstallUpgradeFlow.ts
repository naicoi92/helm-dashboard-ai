import type { UseQueryOptions } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import type { LatestChartVersion } from "../../../API/interfaces";
import {
  type VersionData,
  useChartReleaseValues,
  useGetReleaseManifest,
  useGetVersions,
  useVersionData,
} from "../../../API/releases";
import { useChartRepoValues } from "../../../API/repositories";
import { useDiffData } from "../../../API/shared";
import useCustomSearchParams from "../../../hooks/useCustomSearchParams";
import useDebounce from "../../../hooks/useDebounce";
import { formatYaml, isLikelyValidYaml } from "../../../utils/yaml";

export interface UseInstallUpgradeFlowOptions {
  chartName: string;
  currentlyInstalledChartVersion?: string;
  isUpgrade: boolean;
  isInstallRepoChart?: boolean;
  initialURLMode?: boolean;
  latestRevision?: number;
  /** Initial namespace (upgrade: from URL params; install: empty) */
  initialNamespace?: string;
  /** Initial release name (upgrade: from URL params; install: chartName) */
  initialReleaseName?: string;
  /** For install: filter initial version selection by this repo */
  filterRepo?: string;
  /** Release name used for fetching current manifest (upgrade only) */
  releaseNameForManifest?: string;
}

export function useInstallUpgradeFlow({
  chartName,
  currentlyInstalledChartVersion,
  isUpgrade,
  isInstallRepoChart = false,
  initialURLMode = false,
  latestRevision,
  initialNamespace = "",
  initialReleaseName = "",
  filterRepo,
  releaseNameForManifest = "",
}: UseInstallUpgradeFlowOptions) {
  const [installError, setInstallError] = useState("");

  // --- Namespace / Release name ---
  const { searchParamsObject } = useCustomSearchParams();
  const { filteredNamespace } = searchParamsObject;

  const [namespace, setNamespace] = useState(initialNamespace);
  const [releaseName, setReleaseName] = useState(initialReleaseName);

  // --- Versions ---
  const {
    error: versionsError,
    data: _versions = [],
    isSuccess,
    isLoading: isLoadingVersions,
  } = useGetVersions(chartName);

  const [selectedVersionData, setSelectedVersionData] = useState<VersionData>();

  const [versions, setVersions] = useState<
    Array<LatestChartVersion & { isChartVersion: boolean }>
  >([]);

  const onSuccess = useEffectEvent(() => {
    const empty = { version: "", repository: "", urls: [] };
    const initial = isUpgrade
      ? (_versions[0] ?? empty)
      : filterRepo
        ? (_versions.filter((v) => v.repository === filterRepo)[0] ?? empty)
        : (_versions[0] ?? empty);

    setSelectedVersionData(initial);
    setVersions(
      _versions?.map((v) => ({
        ...v,
        isChartVersion: v.version === currentlyInstalledChartVersion,
      }))
    );
  });

  useEffect(() => {
    if (isSuccess && _versions.length) {
      onSuccess();
    }
  }, [isSuccess, _versions]);

  const selectedVersion = selectedVersionData?.version || "";
  const selectedRepo = selectedVersionData?.repository || "";

  // --- URL mode + chart address ---
  const [chartURL, setChartURL] = useState("");
  const [useURLMode, setUseURLMode] = useState(initialURLMode);

  const repoChartAddress = useMemo(() => {
    if (!selectedVersionData || !selectedVersionData.repository) return "";

    return selectedVersionData.urls?.[0]?.startsWith("file://")
      ? selectedVersionData.urls[0]
      : `${selectedVersionData.repository}/${chartName}`;
  }, [selectedVersionData, chartName]);

  const chartAddress = useURLMode ? chartURL : repoChartAddress || chartURL;

  // --- Chart values (reference, read-only display) ---
  const { data: chartValues = "", isLoading: loadingChartValues } =
    useChartRepoValues({
      version: selectedVersion,
      chart: chartAddress,
    });

  // --- Release values (upgrade only — currently installed values) ---
  const { data: releaseValues = "", isLoading: loadingReleaseValues } =
    useChartReleaseValues({
      namespace,
      release: String(releaseName),
      revision: latestRevision,
      options: { enabled: isUpgrade } as UseQueryOptions<string>,
    });

  // --- Values: single source of truth (controlled editor state) ---
  const [values, setValues] = useState("");
  const debouncedValues = useDebounce(values, 500);
  const [valuesInitialized, setValuesInitialized] = useState(false);

  // Initialize values from releaseValues exactly once (upgrade only).
  // Formatting happens here so the diff uses the formatted value from the
  // start — no separate "raw then formatted" double fetch.
  useEffect(() => {
    if (isUpgrade && releaseValues && !valuesInitialized) {
      formatYaml(releaseValues)
        .then((formatted) => {
          setValues(formatted);
          setValuesInitialized(true);
        })
        .catch(() => {
          setValues(releaseValues);
          setValuesInitialized(true);
        });
    }
  }, [releaseValues, isUpgrade, valuesInitialized]);

  const valuesReady = isUpgrade ? valuesInitialized : true;

  // --- Readiness gate: only compute diff when inputs are valid ---
  const isDataReady =
    Boolean(chartAddress) &&
    Boolean(selectedVersion) &&
    valuesReady &&
    isLikelyValidYaml(debouncedValues);

  // --- Selected version manifest (after-side of the diff) ---
  const { data: selectedVerData = {}, error: selectedVerDataError } =
    useVersionData({
      version: selectedVersion,
      userValues: debouncedValues,
      chartAddress,
      namespace,
      releaseName,
      isInstallRepoChart,
      enabled: isDataReady,
    });

  // --- Current version manifest (before-side, upgrade only) ---
  const { data: currentVerManifest, error: currentVerManifestError } =
    useGetReleaseManifest({
      namespace,
      chartName: releaseNameForManifest,
      options: { enabled: isUpgrade } as UseQueryOptions<string>,
    });

  // --- Diff ---
  const {
    data: diffData,
    isLoading: isLoadingDiff,
    isFetching: isFetchingDiff,
    error: diffError,
  } = useDiffData({
    selectedRepo,
    versionsError: versionsError?.message || "",
    currentVerManifest: currentVerManifest ?? "",
    selectedVerData,
    chart: chartAddress,
  });

  // --- Consolidated error string (type-safe, no casting) ---
  const errorString =
    currentVerManifestError?.message ||
    selectedVerDataError?.message ||
    diffError?.message ||
    installError ||
    versionsError?.message ||
    "";

  return {
    // Version selection
    versions,
    selectedVersionData,
    setSelectedVersionData,
    isLoadingVersions,
    selectedVersion,
    selectedRepo,

    // URL mode + chart address
    chartURL,
    setChartURL,
    useURLMode,
    setUseURLMode,
    chartAddress,

    // Values
    values,
    setValues,
    chartValues,
    loadingChartValues,
    releaseValues,
    loadingReleaseValues,

    // Diff
    diffData,
    isLoadingDiff,
    isFetchingDiff,
    errorString,

    // Namespace / release
    namespace,
    setNamespace,
    releaseName,
    setReleaseName,
    filteredNamespace,

    // Error
    installError,
    setInstallError,
  };
}

export type UseInstallUpgradeFlowReturn = ReturnType<
  typeof useInstallUpgradeFlow
>;
