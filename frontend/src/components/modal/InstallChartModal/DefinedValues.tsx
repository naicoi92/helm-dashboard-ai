import { ChartValues } from "./ChartValues";
import { UserDefinedValues } from "./UserDefinedValues";

interface DefinedValuesProps {
  value: string;
  onUserValuesChange: (values: string) => void;
  chartValues: string;
  loading: boolean;
}

const DefinedValues = ({
  value,
  chartValues,
  onUserValuesChange,
  loading,
}: DefinedValuesProps) => {
  return (
    <div className="mt-4 flex w-full gap-6">
      <UserDefinedValues
        value={value}
        onChange={onUserValuesChange}
        loading={loading}
      />
      <ChartValues chartValues={chartValues} loading={loading} />
    </div>
  );
};

export default DefinedValues;
