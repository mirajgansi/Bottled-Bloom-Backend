export const sendPushNotification = async (
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) => {
  if (!token) return;
};
