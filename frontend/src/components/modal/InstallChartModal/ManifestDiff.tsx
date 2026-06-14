import { Diff2HtmlUI } from "diff2html/lib/ui/js/diff2html-ui-base";
import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import { useEffect, useRef } from "react";

import { diffConfiguration } from "../../../utils";
import Spinner from "../../Spinner";

hljs.registerLanguage("yaml", yaml);

interface ManifestDiffProps {
  diff?: string;
  isLoading: boolean;
  isFetching: boolean;
  error: string;
}

const ManifestDiff = ({
  diff,
  isLoading,
  isFetching,
  error,
}: ManifestDiffProps) => {
  const diffContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Skip drawing during the initial load (no data yet).
    // During background refetches the previous diff stays visible
    // thanks to keepPreviousData, so we only redraw when new data arrives.
    if (isLoading) {
      return;
    }

    if (diff && diffContainerRef.current) {
      const diff2htmlUi = new Diff2HtmlUI(
        diffContainerRef.current,
        diff,
        diffConfiguration,
        hljs
      );
      diff2htmlUi.draw();
      diff2htmlUi.highlightCode();
    }
  }, [diff, isLoading]);

  // Full spinner only on the very first load (no diff rendered yet).
  // Subsequent refetches keep the previous diff visible with an "updating" badge.
  if (isLoading && !error) {
    return (
      <div className="flex items-end text-lg">
        <Spinner />
        Calculating diff...
      </div>
    );
  }

  return (
    <div>
      <h4 className="flex items-center gap-2 text-xl">
        Manifest changes:
        {isFetching && !error && (
          <span className="flex items-center gap-1 text-sm font-normal text-gray-500">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
            updating...
          </span>
        )}
      </h4>

      {error ? (
        <p className="text-lg text-red-600">
          Failed to get upgrade info: {error}
        </p>
      ) : diff ? (
        <div
          ref={diffContainerRef}
          className="relative overflow-y-auto leading-5"
        />
      ) : (
        <pre className="font-roboto text-base">
          No changes will happen to the cluster
        </pre>
      )}
    </div>
  );
};

export default ManifestDiff;
