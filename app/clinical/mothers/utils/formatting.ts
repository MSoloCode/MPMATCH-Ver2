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
 * Format a date to M/D/YYYY only
 */
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate().toString();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format a date to H:MM:SS AM/PM only
 */
export function formatTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = hours.toString();
  return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

/**
 * Format a phone number to display format
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '---';
  return phone;
}

/**
 * Get display name for a facility
 */
export function getFacilityDisplay(facility: any): string {
  if (!facility) return '---';
  return facility.name || '---';
}

/**
 * Get display name for registered by user
 */
export function getRegisteredByDisplay(user: any): string {
  if (!user) return '---';
  return user.username || user.name || '---';
}

/**
 * Get district name
 */
export function getDistrictDisplay(district: any): string {
  if (!district) return '---';
  return district.name || '---';
}

/**
 * Format consent status
 */
export function getConsentDisplay(consentAccepted: boolean | null): string {
  if (consentAccepted) return 'ACCEPTED';
  return 'NOT ACCEPTED';
}
