/**
 * Format a Date object or ISO string to M/D/YYYY, H:MM:SS AM/PM format
 */
export function formatCreatedDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;

  // M/D/YYYY
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate().toString();
  const year = date.getFullYear();

  // H:MM:SS AM/PM
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const hoursStr = hours.toString();

  return `${month}/${day}/${year}, ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Get status display text
 */
export function getStatusDisplay(status: string): string {
  if (!status) return '---';
  return status;
}

/**
 * Get Tailwind CSS class for status badge color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-green-100 text-green-800';
    case 'CLOSED':
      return 'bg-gray-100 text-gray-800';
    case 'DELIVERED':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get high risk display text
 */
export function getHighRiskDisplay(isHighRisk: boolean | null | undefined): string {
  if (isHighRisk === null || isHighRisk === undefined) return '---';
  return isHighRisk ? 'Yes' : 'No';
}

/**
 * Get text color class for high risk display
 */
export function getHighRiskColor(isHighRisk: boolean | null | undefined): string {
  if (isHighRisk === null || isHighRisk === undefined) return 'text-gray-600';
  return isHighRisk ? 'text-red-600' : 'text-gray-600';
}

/**
 * Get formatted mother display (name · phone)
 */
export function getMotherDisplay(mother: any): string {
  if (!mother) return '---';
  const name = mother.fullName || mother.name || '---';
  const phone = mother.phone || '---';
  return `${name} · ${phone}`;
}
