import YamlEditor from "../../common/YamlEditor/YamlEditor";
import Spinner from "../../Spinner";

export const UserDefinedValues = ({
  value,
  onChange,
  loading,
}: {
  value: string;
  onChange: (val: string) => void;
  loading: boolean;
}) => {
  return (
    <div className="w-1/2">
      <label
        className="mb-2 block text-xl font-medium tracking-wide text-gray-700"
        htmlFor="grid-user-defined-values"
      >
        User-Defined Values:
      </label>
      {loading ? <Spinner /> : <YamlEditor value={value} onChange={onChange} />}
    </div>
  );
};
