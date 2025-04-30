export interface AllowedUser {
  role: string;
}

export const allowedUsers: Record<string, AllowedUser> = {
  // Jona Schlegel
  '0000-0002-4190-9566': { role: 'admin' },

  // Leon van Wissen
  '0000-0001-8672-025X': { role: 'editor' },

  // Manjusha Kuruppath
  '0009-0002-8032-7013': { role: 'editor' },
};
