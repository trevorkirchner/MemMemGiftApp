import { getUrl, remove, uploadData } from "aws-amplify/storage";

export async function uploadGiftImage({
  tournamentId,
  giftItemId,
  file,
}: {
  tournamentId: string;
  giftItemId: string;
  file: File;
}) {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;

  const path = `product-images/${tournamentId}/${giftItemId}/${uniqueName}`;

  const result = await uploadData({
    path,
    data: file,
    options: {
      contentType: file.type,
    },
  }).result;

  return result.path;
}

export async function getGiftImageUrl(imageKey: string) {
  const result = await getUrl({
    path: imageKey,
    options: {
      validateObjectExistence: false,
      expiresIn: 3600,
    },
  });

  return result.url.toString();
}

export async function removeGiftImage(imageKey: string) {
  await remove({
    path: imageKey,
  });
}