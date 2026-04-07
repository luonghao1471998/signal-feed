/** Twitter profile image URLs for mock KOLs (handle key without @). */
export const KOL_AVATARS: Record<string, string> = {
  karpathy:
    "https://pbs.twimg.com/profile_images/1296664814284955648/IGnVCMKn_400x400.jpg",
  sama: "https://pbs.twimg.com/profile_images/1840462489051230208/5fqzPzqH_400x400.jpg",
  levelsie: "https://pbs.twimg.com/profile_images/1589751242/petersquare_400x400.jpg",
  rauchg: "https://pbs.twimg.com/profile_images/1783356693820887040/RLTcJSHo_400x400.jpg",
  naval: "https://pbs.twimg.com/profile_images/1256841238298329088/PslN0b-G_400x400.jpg",
  randfish:
    "https://pbs.twimg.com/profile_images/3528935880/e63a3bd43f62c00a3618f89e6264e67a_400x400.jpeg",
  balajis: "https://pbs.twimg.com/profile_images/1635920457705590784/zBp0oD5H_400x400.jpg",
  patio11: "https://pbs.twimg.com/profile_images/565839700630249472/EjSPmFGS_400x400.jpeg",
  emollick: "https://pbs.twimg.com/profile_images/1669437539447451649/RN5jMvKY_400x400.jpg",
  swyx: "https://pbs.twimg.com/profile_images/1771820785620000768/bHFqfqVj_400x400.jpg",
  paulg: "https://pbs.twimg.com/profile_images/1824002576/pg-railsconf_400x400.jpg",
  gregkamradt: "https://pbs.twimg.com/profile_images/1620757621952659456/eWVlJnDu_400x400.jpg",
};

const MOCK_USER_AVATAR =
  "https://pbs.twimg.com/profile_images/1631169016409542657/uo0hTmQT_400x400.jpg";

export { MOCK_USER_AVATAR };

export function kolHandleKey(handle: string): string {
  return handle.replace(/^@/, "");
}

export function kolAvatarUrlForHandle(handle: string): string | undefined {
  const key = kolHandleKey(handle);
  return KOL_AVATARS[key];
}
