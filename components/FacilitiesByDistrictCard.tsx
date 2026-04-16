'use client';

interface FacilityByDistrict {
  districtId: number;
  districtName: string;
  facilityCount: number;
  alertCount: number;
}

interface FacilitiesByDistrictCardProps {
  data: FacilityByDistrict[];
  isLoading?: boolean;
}

export const FacilitiesByDistrictCard = ({ data, isLoading }: FacilitiesByDistrictCardProps) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Facilities by district (top 5)</h3>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin">
            <div className="w-6 h-6 border-3 border-gray-200 border-t-blue-600 rounded-full"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Facilities by district (top 5)</h3>
      {data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((district, index) => (
            <div
              key={district.districtId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full font-bold text-blue-700 text-sm">
                  {index + 1}
                </div>
                <span className="font-medium text-gray-800">{district.districtName}</span>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {district.facilityCount} facilities
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                  {district.alertCount} alerts
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex justify-center items-center py-8 text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
};
