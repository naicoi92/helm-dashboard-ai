import YamlEditor from "../../common/YamlEditor/YamlEditor";
import Spinner from "../../Spinner";

export const ChartValues = ({
  chartValues,
  loading,
}: {
  chartValues: string;
  loading: boolean;
}) => {
  return (
    <div className="w-1/2">
      <label
        className="mb-2 block text-xl font-medium tracking-wide text-gray-700"
        htmlFor="grid-user-defined-values"
      >
        Chart Value Reference:
      </label>
      {loading ? (
        <Spinner />
      ) : !chartValues ? (
        <p className="font-sf-mono text-base font-medium text-gray-500">
          No original values information found
        </p>
      ) : (
        <YamlEditor value={chartValues} readOnly />
      )}
    </div>
  );
};
