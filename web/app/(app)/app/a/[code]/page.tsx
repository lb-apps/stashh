import { entrySheet } from "../../../_features/shell/entry";
import { RedeemLink } from "./redeem-link";

export default async function SignInLinkPage({ params, searchParams }: PageProps<"/app/a/[code]">) {
  const [{ code }, { next }] = await Promise.all([params, searchParams]);
  return <RedeemLink code={code} next={entrySheet(next)} />;
}
