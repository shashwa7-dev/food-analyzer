import { dataUtils } from "@/lib/utils";

interface ConcernsSummaryProps {
  concerns: string[];
  maxDisplay?: number;
}

const ConcernsSummary: React.FC<ConcernsSummaryProps> = ({
  concerns,
  maxDisplay,
}) => {
  const safeConcerns = dataUtils.getSafeConcerns(concerns);

  if (safeConcerns.length === 0) {
    return (
      <div className="bg-green-50 border-l-3 border-green-400 p-2 rounded">
        <p className="text-sm text-green-700">No major concerns identified</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {safeConcerns.slice(0, maxDisplay).map((concern, index) => (
        <div
          key={index}
          className="bg-destructive/10 border-l-4 border-section-concerns p-2 rounded"
        >
          <p className="text-sm text-destructive line-clamp-2">{concern}</p>
        </div>
      ))}
      {/* {safeConcerns.length > maxDisplay && (
        <div className="text-xs text-gray-500 text-center">
          +{safeConcerns.length - maxDisplay} more concerns
        </div>
      )} */}
    </div>
  );
};

export default ConcernsSummary;
