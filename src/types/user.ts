export type ChatUser = {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  photoUrl: string;
  createdAt: number;
};

export type DeviceTokenRecord = {
  token: string;
  platform: 'ios' | 'android' | 'web';
  enabled: boolean;
  updatedAt: number;
};
